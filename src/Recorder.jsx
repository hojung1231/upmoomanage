import { useEffect, useRef, useState } from 'react'
import { startMp3, downloadBlob, canMp3, canCaptureSystem } from './audioRec.js'
import { fmtSize } from './media.js'

// 회의 녹음
// - 받아 적기: 브라우저 음성 인식(크롬/삼성인터넷 내장)으로 내 목소리를 실시간 텍스트로
// - MP3: 핸드폰은 내 목소리, PC는 상대방 목소리(시스템 오디오)까지 합쳐서 이 기기에 저장
const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)
export const canRecord = !!SR || canMp3

const pad = (n) => String(n).padStart(2, '0')
const fmtDur = (s) => `${pad(Math.floor(s / 60))}:${pad(s % 60)}`
const stamp = (s) => `[${fmtDur(s)}]`
const fileName = (d = new Date()) =>
  `회의녹음_${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}.mp3`

function Meter({ label, value }) {
  return (
    <div className="rec-meter">
      <span>{label}</span>
      <i><b style={{ width: `${Math.round(value * 100)}%` }} /></i>
    </div>
  )
}

export default function Recorder({ onSave, onCancel }) {
  const [lines, setLines] = useState([]) // 확정된 문장 [{t, text}]
  const [interim, setInterim] = useState('') // 말하는 중인 문장
  const [state, setState] = useState('idle') // idle | starting | recording | paused
  const [sec, setSec] = useState(0)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const [withOther, setWithOther] = useState(canCaptureSystem) // PC: 상대방 목소리도
  const [lv, setLv] = useState({ mic: 0, sys: 0 })
  const [size, setSize] = useState(0)
  const rec = useRef(null)
  const mp3 = useRef(null)
  const startedAt = useRef(null)
  const want = useRef(false) // 받아 적기를 계속 원하는지 (끊기면 자동 재시작)
  const srOff = useRef(!SR) // 받아 적기 사용 불가
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

  // 소리 들어오는지 표시
  useEffect(() => {
    if (state !== 'recording' || !mp3.current) { setLv({ mic: 0, sys: 0 }); return }
    const t = setInterval(() => {
      setLv(mp3.current.levels())
      setSize(mp3.current.size())
    }, 150)
    return () => clearInterval(t)
  }, [state])

  useEffect(() => { box.current?.scrollTo(0, box.current.scrollHeight) }, [lines, interim])

  useEffect(() => () => {
    want.current = false
    rec.current?.abort()
    mp3.current?.discard()
    keepAwake(false)
  }, [])

  const startEngine = () => {
    if (srOff.current) return
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
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed' || e.error === 'audio-capture') {
        want.current = false
        srOff.current = true
        if (mp3.current) setNotice('이 기기에서는 받아 적기를 같이 할 수 없어 MP3 녹음만 계속합니다.')
        else { setState('idle'); setError('마이크 권한이 필요합니다. 브라우저 설정에서 마이크를 허용해 주세요.') }
      } else if (e.error === 'network') {
        setNotice('인터넷 연결이 불안정합니다. 다시 연결되면 이어서 받아 적습니다.')
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

  const start = async () => {
    setError('')
    if (state === 'idle' && canMp3) {
      setState('starting')
      try {
        mp3.current = await startMp3({
          system: canCaptureSystem && withOther,
          onSystemEnded: () => setNotice('화면 공유가 중지되어 이제 상대방 목소리는 녹음되지 않습니다. (내 목소리는 계속 녹음)'),
        })
        startedAt.current = new Date()
      } catch (e) {
        setState('idle')
        setError(e.message)
        return
      }
    } else {
      mp3.current?.resume()
    }
    want.current = true
    setState('recording')
    keepAwake(true)
    startEngine()
  }
  const pause = () => {
    keepAwake(false)
    want.current = false
    rec.current?.stop()
    mp3.current?.pause()
    setState('paused')
  }
  const finish = async () => {
    keepAwake(false)
    want.current = false
    rec.current?.stop()
    setState('paused')
    if (mp3.current) {
      const blob = mp3.current.stop()
      mp3.current = null
      if (blob.size) downloadBlob(blob, fileName(startedAt.current || new Date()))
    }
    const text = [...lines, ...(interim ? [{ t: secRef.current, text: interim }] : [])]
      .map((l) => `${stamp(l.t)} ${l.text}`)
      .join('\n')
    if (!text.trim()) { onCancel(); return }
    setSaving(true)
    await onSave(text)
  }
  const cancel = () => {
    if (state !== 'idle' && !confirm('녹음한 내용(MP3·받아 적기)을 저장하지 않고 나갈까요?')) return
    want.current = false
    rec.current?.abort()
    mp3.current?.discard()
    mp3.current = null
    onCancel()
  }

  const active = state === 'recording' || state === 'paused'
  const hasSys = mp3.current?.hasSystem

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
          <span className="rec-state">
            {state === 'recording' ? '녹음 중' : state === 'paused' ? '일시정지' : state === 'starting' ? '준비 중…' : '대기'}
            {active && mp3.current ? ` · MP3 ${fmtSize(size)}` : ''}
          </span>
        </div>

        {canCaptureSystem && state === 'idle' && (
          <label className="chk rec-other">
            <input type="checkbox" checked={withOther} onChange={(e) => setWithOther(e.target.checked)} />
            상대방 목소리도 녹음 (화상회의 · 헤드셋)
          </label>
        )}
        {canCaptureSystem && state === 'idle' && withOther && (
          <p className="hint">시작하면 공유 창이 뜹니다 → <b>전체 화면</b> 선택 → <b>시스템 오디오도 공유</b> 켜기 → 공유</p>
        )}

        {active && mp3.current && (
          <div className="rec-meters">
            <Meter label="내 목소리" value={lv.mic} />
            {hasSys && <Meter label="상대방" value={lv.sys} />}
          </div>
        )}

        <div className="rec-text" ref={box}>
          {lines.length === 0 && !interim && (
            <p className="hint">
              {SR ? '녹음을 시작하면 말하는 내용이 여기에 실시간으로 적힙니다.' : '이 브라우저는 받아 적기를 지원하지 않아 MP3만 녹음합니다.'}
              {SR && canCaptureSystem && withOther ? ' (받아 적기는 내 목소리만, MP3에는 상대방 목소리까지 들어갑니다)' : ''}
            </p>
          )}
          {lines.map((l, i) => (
            <p key={i}><span className="rec-ts">{stamp(l.t)}</span> {l.text}</p>
          ))}
          {interim && <p className="rec-interim">{interim}</p>}
        </div>

        {error && <p className="neg hint">{error}</p>}
        {notice && <p className="hint">{notice}</p>}

        <div className="rec-actions">
          {state === 'recording' ? (
            <button className="rec-btn pause" onClick={pause}>⏸ 일시정지</button>
          ) : (
            <button className="rec-btn start" onClick={start} disabled={state === 'starting'}>
              {state === 'paused' ? '● 이어서 녹음' : '● 녹음 시작'}
            </button>
          )}
          <button className="rec-btn save" onClick={finish} disabled={saving || !active}>
            {saving ? '저장 중…' : '■ 종료하고 저장'}
          </button>
        </div>
      </section>
      <p className="hint center">
        종료하면 MP3 파일이 이 기기(다운로드 폴더)에 저장되고, 받아 적은 내용은 회의록으로 저장됩니다.
        {' '}녹음 중에는 화면이 켜진 채로 유지됩니다.
      </p>
    </div>
  )
}
