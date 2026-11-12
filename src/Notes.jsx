import { useState } from 'react'
import { useCollection, addItem, updateItem, removeItem } from './store.js'
import { getApiKey, setApiKey } from './keys.js'

const md = (k) => { const [, m, d] = k.split('-').map(Number); return `${m}/${d}` }
const fmtTime = (t) => {
  const d = new Date(t)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// 회의 텍스트 저장 (요약은 카드의 '요약' 버튼으로)
export async function saveNote(project, text, fileName) {
  return addItem('notes', { projectId: project.id, text, title: fileName || '회의록', status: 'new' })
}

export async function runAnalysis(id, project, text) {
  await updateItem('notes', id, { status: 'analyzing', error: '' })
  try {
    const { analyzeTranscript } = await import('./analyze.js')
    const r = await analyzeTranscript(text, project.name)
    await updateItem('notes', id, { status: 'done', ...r, ...(r.title ? { title: r.title } : {}) })
  } catch (e) {
    await updateItem('notes', id, { status: 'error', error: e.message })
  }
}

function KeySettings({ onDone }) {
  const [key, setKey] = useState(getApiKey())
  return (
    <section className="card">
      <h2>Claude 연결</h2>
      <p className="hint">요약에 쓰는 Claude API 키입니다. 이 기기에만 저장됩니다. console.anthropic.com → API Keys에서 발급.</p>
      <div className="create">
        <input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="sk-ant-..." />
      </div>
      <div className="bactions">
        <button className="primary" onClick={() => { setApiKey(key); onDone() }}>저장</button>
      </div>
    </section>
  )
}

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

      {note.status === 'analyzing' && <p className="hint center">Claude가 요약하는 중입니다…</p>}
      {note.status === 'error' && (
        <section className="card">
          <p className="neg">{note.error}</p>
          <button className="btn-primary block" onClick={() => runAnalysis(note.id, project, note.text)}>다시 요약</button>
        </section>
      )}
      {note.status === 'new' && (
        getApiKey()
          ? <button className="btn-primary block" onClick={() => runAnalysis(note.id, project, note.text)}>✨ 요약</button>
          : <p className="hint center">Claude API 키를 등록하면 요약할 수 있습니다 (회의록 목록 화면의 ⚙️)</p>
      )}

      {note.summary && (
        <section className="card">
          <div className="card-head">
            <h2>요약</h2>
            {note.status === 'done' && <button onClick={() => runAnalysis(note.id, project, note.text)}>다시 요약</button>}
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
  const [settings, setSettings] = useState(false)
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

  const summarize = (n) => {
    if (!getApiKey()) { setSettings(true); return }
    runAnalysis(n.id, project, n.text)
  }

  return (
    <div className="page">
      <header className="bar home-bar">
        <button className="back" onClick={onClose} aria-label="뒤로">‹</button>
        <h1 className="grow">회의록 <small className="sub">{project.name}</small></h1>
        <button className="gear" onClick={() => setSettings(!settings)} aria-label="설정">⚙️</button>
      </header>

      {settings && <KeySettings onDone={() => setSettings(false)} />}

      <label className="btn-primary block upload">
        {busy ? '올리는 중…' : '📄 텍스트 파일 올리기'}
        <input type="file" accept=".txt,text/plain" onChange={onFile} hidden />
      </label>
      <p className="hint center">갤럭시 음성녹음 → 텍스트 변환 → 공유 → 업무관리 로도 넣을 수 있습니다</p>

      <ul className="projects">
        {notes.map((n) => (
          <li key={n.id} className="note-card">
            <button className="note-main" onClick={() => setSelected(n.id)}>
              {n.title}
              <small className="sub">
                {fmtTime(n.createdAt)}
                {n.status === 'error' && ' · 요약 실패'}
                {(n.schedules || []).some((s) => s.status === 'pending') && ' · 스케줄 확인 필요'}
              </small>
            </button>
            {n.status === 'analyzing' ? (
              <span className="sum-btn busy">요약 중…</span>
            ) : n.status === 'done' ? (
              <button className="sum-btn done" onClick={() => setSelected(n.id)}>요약 보기</button>
            ) : (
              <button className="sum-btn" onClick={() => summarize(n)}>✨ 요약</button>
            )}
          </li>
        ))}
        {notes.length === 0 && <li className="empty">회의록이 없습니다</li>}
      </ul>
    </div>
  )
}
