// 회의 녹음 텍스트 → 요약 + 체크리스트 + 스케줄 등록 후보 (Claude API)
// API 키는 이 기기 브라우저에만 저장되고 코드/서버에는 들어가지 않는다.
import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { z } from 'zod'

import { getApiKey } from './keys.js'

const MODEL = 'claude-opus-5-5'

const todayKST = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10)

const Result = z.object({
  title: z.string(),
  summary: z.string(),
  checklist: z.array(z.string()),
  schedules: z.array(
    z.object({
      title: z.string(),
      date: z.string(),
      endDate: z.string(),
      reason: z.string(),
    })
  ),
})

export async function analyzeTranscript(text, projectName) {
  const apiKey = getApiKey()
  if (!apiKey) throw new Error('Claude API 키가 없습니다')

  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })

  const system = `너는 회의록 정리 비서다. 녹음을 텍스트로 변환한 회의 내용을 정리한다.
- title: 회의 내용을 한 줄로 요약한 제목
- summary: 회의 핵심 내용을 3~7줄로 요약 (줄바꿈으로 구분, 각 줄은 "- "로 시작)
- checklist: 실제로 확인·실행해야 할 일이나 결정 사항을 짧은 문장으로, 중복 없이
- schedules: 날짜·기한·기간이 언급되어 스케줄 등록이 필요해 보이는 것만. 없으면 빈 배열
  - date는 YYYY-MM-DD. 기간이면 date=시작일, endDate=종료일. 기간이 아니면 endDate는 빈 문자열
  - "다음 주 금요일", "이번 달 말" 같은 상대 날짜는 오늘(${todayKST()}) 기준으로 계산
  - reason: 회의에서 나온 근거 한 줄
프로젝트: ${projectName}`

  let res
  try {
    res = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: betaZodOutputFormat(Result) },
      system,
      messages: [{ role: 'user', content: text }],
    })
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new Error('Claude API 키가 올바르지 않습니다')
    if (e instanceof Anthropic.RateLimitError) throw new Error('요청이 많습니다. 잠시 후 다시 시도해 주세요')
    if (e instanceof Anthropic.APIError) throw new Error(`Claude 오류 (${e.status}): ${e.message}`)
    throw new Error('Claude에 연결하지 못했습니다')
  }
  if (res.stop_reason === 'refusal') throw new Error('Claude가 이 내용의 요약을 거절했습니다')
  if (res.stop_reason === 'max_tokens') throw new Error('내용이 너무 길어 요약이 잘렸습니다')
  const out = res.parsed_output
  if (!out) throw new Error('요약 결과를 읽지 못했습니다')

  const isDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || '')
  return {
    title: out.title,
    summary: out.summary,
    checklist: out.checklist.map((t) => ({ text: t, done: false })),
    schedules: out.schedules
      .filter((s) => s.title && isDate(s.date))
      .map((s) => ({
        title: s.title,
        date: s.date,
        ...(isDate(s.endDate) && s.endDate > s.date ? { endDate: s.endDate } : {}),
        reason: s.reason,
        status: 'pending', // pending | added | skipped
      })),
  }
}
