// 회의 녹음 텍스트 → 체크리스트 요약 + 스케줄 등록 후보 (OpenAI API)
// API 키는 이 기기 브라우저에만 저장되고 코드/서버에는 들어가지 않는다.
const KEY = 'upmoo:openai-key'
const MODEL_KEY = 'upmoo:openai-model'
export const DEFAULT_MODEL = 'gpt-4o-mini'

export const getApiKey = () => { try { return localStorage.getItem(KEY) || '' } catch { return '' } }
export const setApiKey = (v) => { try { localStorage.setItem(KEY, v.trim()) } catch {} }
export const getModel = () => { try { return localStorage.getItem(MODEL_KEY) || DEFAULT_MODEL } catch { return DEFAULT_MODEL } }
export const setModel = (v) => { try { localStorage.setItem(MODEL_KEY, v.trim() || DEFAULT_MODEL) } catch {} }

const todayKST = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10)

export async function analyzeTranscript(text, projectName) {
  const apiKey = getApiKey()
  if (!apiKey) throw new Error('OpenAI API 키가 없습니다')

  const system = `너는 회의록 정리 비서다. 녹음을 텍스트로 변환한 회의 내용을 받아 다음 JSON만 출력한다.
{
  "title": "회의 내용을 한 줄로 요약한 제목",
  "checklist": ["해야 할 일 또는 결정 사항을 짧은 문장으로", ...],
  "schedules": [{"title": "일정 이름", "date": "YYYY-MM-DD", "endDate": "YYYY-MM-DD 또는 생략", "reason": "회의에서 나온 근거 한 줄"}]
}
규칙:
- checklist는 실제로 확인·실행해야 할 항목 위주로, 중복 없이.
- schedules에는 날짜·기한·기간이 언급되어 스케줄 등록이 필요해 보이는 것만 넣는다. 없으면 빈 배열.
- "다음 주 금요일", "이번 달 말" 같은 상대 날짜는 오늘 날짜(${todayKST()}) 기준으로 계산한다.
- 기간이면 date=시작일, endDate=종료일. 마감일만 있으면 date=마감일.
- 프로젝트: ${projectName}`

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: getModel(),
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: text },
      ],
    }),
  })
  if (!res.ok) {
    let msg = `OpenAI 오류 (${res.status})`
    try { msg += ': ' + (await res.json()).error.message } catch {}
    throw new Error(msg)
  }
  const data = await res.json()
  const out = JSON.parse(data.choices[0].message.content)
  const isDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || '')
  return {
    title: String(out.title || ''),
    checklist: (out.checklist || []).map((t) => ({ text: String(t), done: false })),
    schedules: (out.schedules || [])
      .filter((s) => s && s.title && isDate(s.date))
      .map((s) => ({
        title: String(s.title),
        date: s.date,
        ...(isDate(s.endDate) && s.endDate > s.date ? { endDate: s.endDate } : {}),
        reason: String(s.reason || ''),
        status: 'pending', // pending | added | skipped
      })),
  }
}
