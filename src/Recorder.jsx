import { useEffect, useRef, useState } from 'react'
import { useRecording, useViewingRecorder, record, recordPc, pause, finish, discard, fmtDur, stamp, canRecord, canRecordPc } from './recording.js'

// 브라우저 음성 인식(크롬/삼성인터넷 내장)으로 회의 내용을 실시간 텍스트로 받아 적는 화면.
// 녹음 자체는 recording.js 가 앱 전체에서 유지하므로, 이 화면을 나가도 계속 녹음된다.
export { canRecord }

export default function Recorder({ project, onBack, onSave }) {
  const s = useRecording()
  useViewingRecorder()
  const [saving, setSaving] = useState(false)
  const box = useRef(null)
  useEffect(() => { box.current?.scrollTo(0, box.current.scrollHeight) }, [s.lines, s.interim])

  const otherProject = s.project && s.project.id !== project.id
  const save = async () => {
    setSaving(true)
    const out = await finish()
    if (!out.audio && !out.text.trim()) { onBack(); return }
    await onSave(out)
  }
  const throwAway = () => {
    if ((s.lines.length || s.interim || s.mode === 'pc') && !confirm('녹음한 내용을 저장하지 않고 버릴까요?')) return
    discard()
    onBack()
  }

  return (
    <div className="page">
      <header className="bar">
        <button className="back" onClick={onBack} aria-label="뒤로">‹</button>
        <h1>회의 녹음 {s.project && <small className="sub">{s.project.name}</small>}</h1>
      </header>

      {otherProject && <p className="hint center">다른 프로젝트({s.project.name})에서 녹음 중입니다. 저장하면 그 프로젝트 회의록에 들어갑니다.</p>}

      <section className="card rec-card">
        <div className="rec-top">
          <span className={'rec-dot' + (s.status === 'recording' ? ' on' : '')} />
          <strong className="rec-time">{fmtDur(s.sec)}</strong>
          <span className="rec-state">{s.status === 'recording' ? (s.mode === 'pc' ? 'PC 회의 녹음 중' : '받아 적는 중') : s.status === 'paused' ? '일시정지' : '대기'}</span>
        </div>

        <div className="rec-text" ref={box}>
          {s.mode === 'pc' ? (
            <p className="hint">상대방 소리(공유한 화면·탭)와 내 마이크를 함께 음성 파일로 녹음하고 있습니다.<br />실시간 글자는 나오지 않고, 저장 후 "회의록 요약해줘" 하면 받아쓰기와 요약이 채워집니다.</p>
          ) : s.lines.length === 0 && !s.interim && (
            <p className="hint">녹음을 시작하면 말하는 내용이 여기에 실시간으로 적힙니다.</p>
          )}
          {s.lines.map((l, i) => (
            <p key={i}><span className="rec-ts">{stamp(l.t)}</span> {l.text}</p>
          ))}
          {s.interim && <p className="rec-interim">{s.interim}</p>}
        </div>

        {s.error && <p className="neg hint">{s.error}</p>}

        <div className="rec-actions">
          {s.status === 'recording' ? (
            <button className="rec-btn pause" onClick={pause}>⏸ 일시정지</button>
          ) : (
            <button className="rec-btn start" onClick={() => record(s.project || project)}>{s.status === 'paused' ? '● 이어서 녹음' : '● 녹음 시작'}</button>
          )}
          <button className="rec-btn save" onClick={save} disabled={saving || s.status === 'idle'}>
            {saving ? '저장 중…' : '■ 종료하고 저장'}
          </button>
        </div>
        {s.status === 'idle' && canRecordPc && (
          <div className="rec-pc">
            <button className="rec-btn pc" onClick={() => recordPc(project)}>🖥 PC 회의 녹음 (상대방 소리 포함)</button>
            <p className="hint">팀즈·줌 회의를 PC로 할 때 사용. 누르면 나오는 공유 창에서 <b>회의 창 또는 전체 화면</b>을 고르고 <b>"시스템 오디오 공유"</b>를 켜세요.</p>
          </div>
        )}
        {s.status !== 'idle' && <button className="link rec-discard" onClick={throwAway}>저장하지 않고 버리기</button>}
      </section>
      <p className="hint center">녹음 중에도 ‹ 뒤로 가서 데이터·사업비 등 다른 화면을 볼 수 있습니다. 화면 아래 빨간 막대로 계속 녹음됩니다.<br />단, 다른 앱으로 가거나 화면을 끄면 받아 적기가 멈춥니다.</p>
    </div>
  )
}
