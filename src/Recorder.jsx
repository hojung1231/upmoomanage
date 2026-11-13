import { useEffect, useRef, useState } from 'react'

// 브라우저 음성 인식(크롬/삼성인터넷 내장)으로 회의 내용을 실시간 텍스트로 받아 적는다.
const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)
export const canRecord = !!SR

const pad = (n) => String(n).padStart(2, '0')
const fmtDur = (s) => `${pad(Math.floor(s / 60))}:${pad(s % 60)}`
const stamp = (s) => `[${fmtDur(s)}]`

export default function Recorder({ onSave, onCancel }) {
  const [lines, setLines] = useState([]) // 확정된 문장 [{t, text}]
  const [interim, setInterim] = useState('') // 말하는 중인 문장
  const [state, setState] = useState('idle') // idle | recording | paused
  const [sec, setSec] = useState(0)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const rec = useRef(null)
  const want = useRef(false) // 사용자가 녹음 중을 원하는지 (끊기면 자동 재시작)
  const secRef = useRef(0)
  const box = useRef(null)
  const lock = useRef(null) // 녹음 중 화면 꺼짐 방지
  const keepAwake = async (on) => {
    try {
      if (on && 'wakeLock' in navigator) lock.current = await navigator.wakeLock.request('screen')
      else { await lock.current?.release(); lock.current = null }
    } catch {}
  }

  useEffect(() => {
    if (state !== 'recording') return
    const t = setInterval(() => { secRef.current += 1; setSec(secRef.current) }, 1000)
    return () => clearInterval(t)
  }, [state])

  useEffect(() => { box.current?.scrollTo(0, box.current.scrollHeight) }, [lines, interim])

  useEffect(() => () => { want.current = false; rec.current?.abort(); keepAwake(false) }, [])

  const startEngine = () => {
    const r = new SR()
    r.lang = 'ko-KR'
    r.continuous = true
    r.interimResults = true
    r.onresult = (e) => {
      let tmp = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]
        const text = res[0].transcript.trim()
        if (res.isFinal) {
          if (text) setLines((l) => [...l, { t: secRef.current, text }])
        } else {
          tmp += res[0].transcript
        }
      }
      setInterim(tmp.trim())
    }
    r.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        want.current = false
        setState('idle')
        setError('마이크 권한이 필요합니다. 브라우저 설정에서 마이크를 허용해 주세요.')
      } else if (e.error === 'network') {
        setError('인터넷 연결이 불안정합니다. 다시 연결되면 이어서 받아 적습니다.')
      }
    }
    // 잠깐 조용하면 인식이 끝나버리므로, 녹음 중이면 바로 다시 시작
    r.onend = () => {
      setInterim('')
      if (want.current) {
        try { r.start() } catch { setTimeout(() => want.current && startEngine(), 300) }
      }
    }
    rec.current = r
    r.start()
  }

  const start = () => {
    setError('')
    want.current = true
    setState('recording')
    keepAwake(true)
    startEngine()
  }
  const pause = () => {
    keepAwake(false)
    want.current = false
    rec.current?.stop()
    setState('paused')
  }
  const finish = async () => {
    keepAwake(false)
    want.current = false
    rec.current?.stop()
    setState('paused')
    const text = [...lines, ...(interim ? [{ t: secRef.current, text: interim }] : [])]
      .map((l) => `${stamp(l.t)} ${l.text}`)
      .join('\n')
    if (!text.trim()) { onCancel(); return }
    setSaving(true)
    await onSave(text)
  }
  const cancel = () => {
    if ((lines.length || interim) && !confirm('녹음한 내용을 저장하지 않고 나갈까요?')) return
    want.current = false
    rec.current?.abort()
    onCancel()
  }

  return (
    <div className="page">
      <header className="bar">
        <button className="back" onClick={cancel} aria-label="뒤로">‹</button>
        <h1>회의 녹음</h1>
      </header>

      <section className="card rec-card">
        <div className="rec-top">
          <span className={'rec-dot' + (state === 'recording' ? ' on' : '')} />
          <strong className="rec-time">{fmtDur(sec)}</strong>
          <span className="rec-state">{state === 'recording' ? '받아 적는 중' : state === 'paused' ? '일시정지' : '대기'}</span>
        </div>

        <div className="rec-text" ref={box}>
          {lines.length === 0 && !interim && (
            <p className="hint">녹음을 시작하면 말하는 내용이 여기에 실시간으로 적힙니다.</p>
          )}
          {lines.map((l, i) => (
            <p key={i}><span className="rec-ts">{stamp(l.t)}</span> {l.text}</p>
          ))}
          {interim && <p className="rec-interim">{interim}</p>}
        </div>

        {error && <p className="neg hint">{error}</p>}

        <div className="rec-actions">
          {state === 'recording' ? (
            <button className="rec-btn pause" onClick={pause}>⏸ 일시정지</button>
          ) : (
            <button className="rec-btn start" onClick={start}>{state === 'paused' ? '● 이어서 녹음' : '● 녹음 시작'}</button>
          )}
          <button className="rec-btn save" onClick={finish} disabled={saving || state === 'idle'}>
            {saving ? '저장 중…' : '■ 종료하고 저장'}
          </button>
        </div>
      </section>
      <p className="hint center">녹음 중에는 화면이 켜진 채로 유지됩니다. 다른 앱으로 가면 받아 적기가 멈춥니다.</p>
    </div>
  )
}
