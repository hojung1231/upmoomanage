// 회의 녹음(실시간 받아쓰기) 상태를 앱 전체에서 하나로 유지한다.
// 화면(데이터, 사업비 등)을 옮겨 다녀도 녹음은 계속되고, 어디서든 작은 막대로 보인다.
import { useEffect, useState } from 'react'

const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)
export const canRecord = !!SR
// PC 회의 녹음: 화면/탭 공유의 소리(상대방) + 내 마이크를 섞어 음성 파일로 녹음 → 나중에 Whisper로 받아쓰기
export const canRecordPc = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia && typeof MediaRecorder !== 'undefined' && !/Android|iPhone|iPad/i.test(navigator.userAgent)

const pad = (n) => String(n).padStart(2, '0')
export const fmtDur = (s) => `${pad(Math.floor(s / 60))}:${pad(s % 60)}`
export const stamp = (s) => `[${fmtDur(s)}]`

const empty = () => ({ status: 'idle', lines: [], interim: '', sec: 0, error: '', project: null, startedAt: 0, mode: 'live', viewing: st?.viewing || false })
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
  if (st.status !== 'idle' && (st.lines.length || st.interim || st.mode === 'pc')) { e.preventDefault(); e.returnValue = '' }
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

// ---- PC 회의 녹음 (음성 파일) ----
let pc = null // { rec, chunks, streams, ctx }
const stopPc = () => {
  if (!pc) return
  pc.streams.forEach((s) => s.getTracks().forEach((t) => t.stop()))
  pc.ctx.close().catch(() => {})
}
async function startPc(project) {
  let screen, mic
  try {
    screen = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }, systemAudio: 'include' })
  } catch {
    set({ error: '화면 공유를 취소했습니다.' })
    return
  }
  if (!screen.getAudioTracks().length) {
    screen.getTracks().forEach((t) => t.stop())
    set({ error: '공유 창에서 "시스템 오디오 공유"(또는 "탭 오디오 공유")를 켜야 상대방 소리가 녹음됩니다. 다시 시작해 주세요.' })
    return
  }
  try { mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }) } catch { mic = null }
  const ctx = new AudioContext()
  const dest = ctx.createMediaStreamDestination()
  ctx.createMediaStreamSource(new MediaStream(screen.getAudioTracks())).connect(dest)
  if (mic) ctx.createMediaStreamSource(mic).connect(dest)
  const type = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'].find((t) => MediaRecorder.isTypeSupported(t)) || ''
  const rec = new MediaRecorder(dest.stream, { ...(type ? { mimeType: type } : {}), audioBitsPerSecond: 32000 })
  const chunks = []
  pc = { rec, chunks, streams: [screen, mic].filter(Boolean), ctx }
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data) }
  rec.start(10000)
  // 브라우저의 '공유 중지'를 누르면 녹음을 일시정지
  screen.getAudioTracks()[0].onended = () => { if (st.status === 'recording') pause() }
  set({ ...empty(), project, startedAt: Date.now(), mode: 'pc', status: 'recording', error: mic ? '' : '마이크를 못 써서 상대방 소리만 녹음합니다.' })
  startTimer()
  keepAwake(true)
}
export const recordPc = (project) => { if (st.status === 'idle') startPc(project) }

// 녹음 시작/이어서 녹음. project 는 처음 시작할 때만 필요
export function record(project) {
  if (st.mode === 'pc' && st.status === 'paused') {
    if (pc?.streams[0].getAudioTracks()[0]?.readyState !== 'live') { set({ error: '화면 공유가 끝나서 이어서 녹음할 수 없습니다. 종료하고 저장해 주세요.' }); return }
    pc.rec.resume(); set({ status: 'recording', error: '' }); startTimer(); keepAwake(true); return
  }
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
  if (st.mode === 'pc') { if (pc?.rec.state === 'recording') pc.rec.pause(); set({ status: 'paused' }); return }
  engine?.stop()
  set({ status: 'paused' })
}

// 녹음 종료: 받아 적은 글(또는 PC 녹음이면 음성 파일)과 프로젝트를 돌려주고 상태를 비운다
export async function finish() {
  want = false
  stopTimer()
  keepAwake(false)
  if (st.mode === 'pc') {
    const p = pc
    pc = null
    const audio = await new Promise((resolve) => {
      if (!p || p.rec.state === 'inactive') return resolve(null)
      p.rec.onstop = () => resolve(new Blob(p.chunks, { type: p.rec.mimeType || 'audio/webm' }))
      p.rec.stop()
    })
    if (p) { pc = p; stopPc(); pc = null }
    const out = { project: st.project, text: '', audio, sec: st.sec, startedAt: st.startedAt }
    set(empty())
    return out
  }
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
  if (pc) { try { pc.rec.stop() } catch {} stopPc(); pc = null }
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
