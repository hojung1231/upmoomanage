import { useState } from 'react'
import { useCollection, addItem, updateItem, removeItem, syncEnabled } from './store.js'

const md = (k) => { const [, m, d] = k.split('-').map(Number); return `${m}/${d}` }
const fmtTime = (t) => {
  const d = new Date(t)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// 회의 텍스트 저장 (요약은 카드의 '요약' 버튼으로 요청)
export async function saveNote(project, text, fileName) {
  return addItem('notes', { projectId: project.id, text, title: fileName || '회의록', status: 'new' })
}

// 요약 요청: Claude Code(사용자 Claude 계정)가 요청된 회의록을 읽어 요약을 채워 넣는다
const requestSummary = (id) => updateItem('notes', id, { status: 'requested', error: '' })
const ASK_TEXT = 'Claude 앱에서 업무관리 세션에 "회의록 요약해줘"라고 보내면 요약이 채워집니다'

function NoteDetail({ note, project, onBack }) {
  const [showText, setShowText] = useState(false)
  const checklist = note.checklist || []
  const schedules = note.schedules || []
  const pending = schedules.filter((s) => s.status === 'pending')
  const [unpicked, setUnpicked] = useState(() => new Set()) // 체크 해제한 항목
  const isPicked = (i) => !unpicked.has(i)
  const pickedCount = pending.filter((_, i) => isPicked(i)).length

  const toggleCheck = (i) =>
    updateItem('notes', note.id, { checklist: checklist.map((c, j) => (j === i ? { ...c, done: !c.done } : c)) })

  const decide = async (add) => {
    const next = schedules.map((s) => ({ ...s }))
    let pi = 0
    for (const s of next) {
      if (s.status !== 'pending') continue
      if (add && isPicked(pi)) {
        await addItem('events', {
          projectId: project.id, title: s.title, date: s.date,
          ...(s.endDate ? { endDate: s.endDate } : {}), noteId: note.id,
        })
        s.status = 'added'
      } else {
        s.status = 'skipped'
      }
      pi++
    }
    updateItem('notes', note.id, { schedules: next })
  }

  return (
    <div className="page">
      <header className="bar">
        <button className="back" onClick={onBack} aria-label="뒤로">‹</button>
        <h1>{note.title} <small className="sub">{fmtTime(note.createdAt)}</small></h1>
      </header>

      {note.status === 'requested' && (
        <section className="card ask">
          <h2>요약 요청됨</h2>
          <p className="hint">{ASK_TEXT}</p>
          <div className="bactions">
            <button onClick={() => updateItem('notes', note.id, { status: note.summary ? 'done' : 'new' })}>요청 취소</button>
          </div>
        </section>
      )}
      {note.status === 'new' && (
        syncEnabled
          ? <button className="btn-primary block" onClick={() => requestSummary(note.id)}>✨ 요약 요청</button>
          : <p className="hint center">요약 요청은 PC·폰 연동 설정 후 사용할 수 있습니다</p>
      )}

      {note.summary && (
        <section className="card">
          <div className="card-head">
            <h2>요약</h2>
            {note.status === 'done' && <button onClick={() => requestSummary(note.id)}>다시 요약</button>}
          </div>
          <p className="summary-text">{note.summary}</p>
        </section>
      )}

      {pending.length > 0 && (
        <section className="card ask">
          <h2>스케줄에 등록할까요?</h2>
          <ul className="exp">
            {pending.map((s, i) => (
              <li key={i}>
                <input
                  type="checkbox"
                  checked={isPicked(i)}
                  onChange={() => {
                    const n = new Set(unpicked)
                    n.has(i) ? n.delete(i) : n.add(i)
                    setUnpicked(n)
                  }}
                />
                <span className="d">{md(s.date)}{s.endDate ? `~${md(s.endDate)}` : ''}</span>
                <span className="t">{s.title}{s.reason && <small className="reason">{s.reason}</small>}</span>
              </li>
            ))}
          </ul>
          <div className="bactions">
            <button onClick={() => decide(false)}>등록 안 함</button>
            <button className="primary" onClick={() => decide(true)} disabled={pickedCount === 0}>
              선택한 {pickedCount}개 등록
            </button>
          </div>
        </section>
      )}

      {checklist.length > 0 && (
        <section className="card">
          <h2>체크리스트</h2>
          <ul className="checklist">
            {checklist.map((c, i) => (
              <li key={i} className={c.done ? 'done' : ''}>
                <label><input type="checkbox" checked={c.done} onChange={() => toggleCheck(i)} /> {c.text}</label>
              </li>
            ))}
          </ul>
        </section>
      )}

      {schedules.some((s) => s.status === 'added') && (
        <section className="card">
          <h2>등록된 일정</h2>
          <ul className="exp">
            {schedules.filter((s) => s.status === 'added').map((s, i) => (
              <li key={i}><span className="d">{md(s.date)}{s.endDate ? `~${md(s.endDate)}` : ''}</span><span className="t">{s.title}</span></li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <div className="card-head">
          <h2>원문</h2>
          <button onClick={() => setShowText(!showText)}>{showText ? '접기' : '보기'}</button>
        </div>
        {showText && <pre className="raw">{note.text}</pre>}
      </section>

      <div className="bactions">
        <button onClick={() => { if (confirm('이 회의록을 삭제할까요?')) { removeItem('notes', note.id); onBack() } }}>회의록 삭제</button>
      </div>
    </div>
  )
}

export default function Notes({ project, onClose, openId }) {
  const notes = useCollection('notes')
    .filter((n) => n.projectId === project.id)
    .sort((a, b) => b.createdAt - a.createdAt)
  const [selected, setSelected] = useState(openId || null)
  const [busy, setBusy] = useState(false)

  const note = notes.find((n) => n.id === selected)
  if (note) return <NoteDetail note={note} project={project} onBack={() => setSelected(null)} />

  const onFile = async (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setBusy(true)
    await saveNote(project, await f.text(), f.name.replace(/\.txt$/i, ''))
    setBusy(false)
  }

  return (
    <div className="page">
      <header className="bar">
        <button className="back" onClick={onClose} aria-label="뒤로">‹</button>
        <h1>회의록 <small className="sub">{project.name}</small></h1>
      </header>

      <label className="btn-primary block upload">
        {busy ? '올리는 중…' : '📄 텍스트 파일 올리기'}
        <input type="file" accept=".txt,text/plain" onChange={onFile} hidden />
      </label>
      <p className="hint center">갤럭시 음성녹음 → 텍스트 변환 → 공유 → 업무관리 로도 넣을 수 있습니다</p>
      {!syncEnabled && <p className="hint center">요약 요청은 PC·폰 연동 설정 후 사용할 수 있습니다</p>}
      {notes.some((n) => n.status === 'requested') && <p className="hint center">{ASK_TEXT}</p>}

      <ul className="projects">
        {notes.map((n) => (
          <li key={n.id} className="note-card">
            <button className="note-main" onClick={() => setSelected(n.id)}>
              {n.title}
              <small className="sub">
                {fmtTime(n.createdAt)}
                {(n.schedules || []).some((s) => s.status === 'pending') && ' · 스케줄 확인 필요'}
              </small>
            </button>
            {n.status === 'requested' ? (
              <span className="sum-btn busy">요청됨</span>
            ) : n.status === 'done' ? (
              <button className="sum-btn done" onClick={() => setSelected(n.id)}>요약 보기</button>
            ) : syncEnabled ? (
              <button className="sum-btn" onClick={() => requestSummary(n.id)}>✨ 요약</button>
            ) : null}
          </li>
        ))}
        {notes.length === 0 && <li className="empty">회의록이 없습니다</li>}
      </ul>
    </div>
  )
}
