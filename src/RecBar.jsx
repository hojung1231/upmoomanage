// 녹음 중일 때 모든 화면 아래에 떠 있는 작은 막대
import { useState } from 'react'
import { useRecording, record, pause, finish, fmtDur, recTitle } from './recording.js'
import { saveNote, saveAudioNote } from './Notes.jsx'

export default function RecBar({ onOpen }) {
  const s = useRecording()
  const [saved, setSaved] = useState('')
  if (saved) return <div className="rec-bar saved">✓ {saved}</div>
  if (s.status === 'idle' || s.viewing) return null

  const last = s.mode === 'pc' ? (s.status === 'recording' ? 'PC 회의 녹음 중 (상대방+내 목소리)' : '일시정지됨') : s.interim || s.lines[s.lines.length - 1]?.text || (s.status === 'recording' ? '듣는 중…' : '일시정지됨')
  const save = async () => {
    if (!confirm('녹음을 끝내고 회의록에 저장할까요?')) return
    const out = await finish()
    if (out.audio) await saveAudioNote(out.project, out)
    else if (!out.text.trim()) return
    else await saveNote(out.project, out.text, recTitle(out.startedAt))
    setSaved(`${out.project.name} 회의록에 저장했습니다`)
    setTimeout(() => setSaved(''), 3000)
  }

  return (
    <div className={'rec-bar' + (s.status === 'recording' ? ' on' : '')}>
      <button className="rec-bar-main" onClick={() => onOpen(s.project)} title="녹음 화면 열기">
        <span className={'rec-dot' + (s.status === 'recording' ? ' on' : '')} />
        <strong>{fmtDur(s.sec)}</strong>
        <span className="rec-bar-text">{last}</span>
      </button>
      {s.status === 'recording'
        ? <button onClick={pause} aria-label="일시정지">⏸</button>
        : <button onClick={() => record(s.project)} aria-label="이어서 녹음">●</button>}
      <button onClick={save} aria-label="종료하고 저장">■</button>
    </div>
  )
}
