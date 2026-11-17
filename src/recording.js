// 회의 녹음(실시간 받아쓰기) 상태를 앱 전체에서 하나로 유지한다.
// 화면(데이터, 사업비 등)을 옮겨 다녀도 녹음은 계속되고, 어디서든 작은 막대로 보인다.
import { useEffect, useState } from 'react'

const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)
export const canRecord = !!SR

const pad = (n) => String(n).padStart(2, '0')
export const fmtDur = (s) => `${pad(Math.floor(s / 60))}:${pad(s % 60)}`
export const stamp = (s) => `[${fmtDur(s)}]`

const empty = () => ({ status: 'idle', lines: [], interim: '', sec: 0, error: '', project: null, startedAt: 0, viewing: st?.viewing || false })
let st
st = empty()
const subs = new Set()
const set = (patch) => { st = { ...st, ...patch }; subs.forEach((fn) => fn(st)) }

export function useRecording() {
  const [s, setS] = useState(st)
  useEffect(() => { subs.add(setS); setS(st); return () => subs.delete(setS) }, [])
  return s
}
export const getRecording = () => st

let engine = null
let want = false
let timer = null
let lock = null

const keepAwake = async (on) => {
  try {
    if (on && 'wakeLock' in navigator) lock = await navigator.wakeLock.request('screen')
    else { await lock?.release(); lock = null }
  } catch {}
}
// 화면이 다시 보이면 화면 꺼짐 방지를 다시 건다 (브라우저가 자동 해제함)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && st.status === 'recording') keepAwake(true)
})
// 녹음 중에 앱(탭)을 닫으려 하면 경고
window.addEventListener('beforeunload', (e) => {
  if (st.status !== 'idle' && (st.lines.length || st.interim)) { e.preventDefault(); e.returnValue = '' }
})

function startEngine() {
  const r = new (window.SpeechRecognition || window.webkitSpeechRecognition)()
  r.lang = 'ko-KR'
  r.continuous = true
  r.interimResults = true
  r.onresult = (e) => {
    let tmp = ''
    const add = []
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const res = e.results[i]
      const text = res[0].transcript.trim()
      if (res.isFinal) { if (text) add.push({ t: st.sec, text }) } else tmp += res[0].transcript
    }
    set({ lines: add.length ? [...st.lines, ...add] : st.lines, interim: tmp.trim() })
  }
  r.onerror = (e) => {
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
      want = false
      stopTimer()
      set({ status: st.lines.length ? 'paused' : 'idle', error: '마이크 권한이 필요합니다. 브라우저 설정에서 마이크를 허용해 주세요.' })
    } else if (e.error === 'network') {
      set({ error: '인터넷 연결이 불안정합니다. 다시 연결되면 이어서 받아 적습니다.' })
    }
  }
  // 잠깐 조용하면 인식이 끝나버리므로, 녹음 중이면 바로 다시 시작
  r.onend = () => {
    set({ interim: '' })
    if (want && engine === r) {
      try { r.start() } catch { setTimeout(() => want && engine === r && startEngine(), 300) }
    }
  }
  engine = r
  r.start()
}

const startTimer = () => { stopTimer(); timer = setInterval(() => set({ sec: st.sec + 1 }), 1000) }
const stopTimer = () => { clearInterval(timer); timer = null }

// 녹음 시작/이어서 녹음. project 는 처음 시작할 때만 필요
export function record(project) {
  if (!SR) return
  if (st.status === 'idle') set({ ...empty(), project, startedAt: Date.now() })
  want = true
  set({ status: 'recording', error: '' })
  startTimer()
  keepAwake(true)
  startEngine()
}

export function pause() {
  want = false
  stopTimer()
  keepAwake(false)
  engine?.stop()
  set({ status: 'paused' })
}

// 녹음 종료: 받아 적은 글과 프로젝트를 돌려주고 상태를 비운다
export function finish() {
  want = false
  stopTimer()
  keepAwake(false)
  const r = engine
  engine = null
  r?.stop()
  const all = [...st.lines, ...(st.interim ? [{ t: st.sec, text: st.interim }] : [])]
  const text = all.map((l) => `${stamp(l.t)} ${l.text}`).join('\n')
  const out = { project: st.project, text, startedAt: st.startedAt }
  set(empty())
  return out
}

export function discard() {
  want = false
  stopTimer()
  keepAwake(false)
  const r = engine
  engine = null
  r?.abort()
  set(empty())
}

export const recTitle = (t) => {
  const d = new Date(t || Date.now())
  return `회의 녹음 ${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// 녹음 화면을 보고 있는지 (보고 있으면 아래 막대를 숨김)
let viewingCount = 0
export function useViewingRecorder() {
  useEffect(() => {
    viewingCount++
    set({ viewing: true })
    return () => { viewingCount--; set({ viewing: viewingCount > 0 }) }
  }, [])
}
