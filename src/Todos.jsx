import { useEffect, useRef, useState } from 'react'
import { useCollection, addItem, updateItem, removeItem } from './store.js'

const byCreated = (a, b) => a.createdAt - b.createdAt

// 완성도 슬라이더: 드래그 중엔 화면만 바꾸고, 멈추면 저장
function PartRow({ part }) {
  const [val, setVal] = useState(part.progress || 0)
  const [editing, setEditing] = useState(false)
  const [note, setNote] = useState(part.note || '')
  const timer = useRef(null)
  const saveNote = () => {
    updateItem('parts', part.id, { note: note.trim() })
    setEditing(false)
  }
  useEffect(() => setVal(part.progress || 0), [part.progress])

  const change = (v) => {
    setVal(v)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => updateItem('parts', part.id, { progress: v }), 400)
  }

  return (
    <li className="part">
      <div className="part-head">
        <span className="t">{part.name}</span>
        <strong className={val >= 100 ? 'full' : ''}>{val}%</strong>
        <button className="del" onClick={() => removeItem('parts', part.id)} aria-label="삭제">✕</button>
      </div>
      <input
        type="range"
        min="0"
        max="100"
        step="5"
        value={val}
        onChange={(e) => change(Number(e.target.value))}
        style={{ '--p': val + '%' }}
        aria-label={`${part.name} 완성도`}
      />
      {editing ? (
        <div className="note-edit">
          <textarea autoFocus rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="각주 입력" />
          <div className="bactions">
            <button onClick={() => { setNote(part.note || ''); setEditing(false) }}>취소</button>
            <button className="primary" onClick={saveNote}>저장</button>
          </div>
        </div>
      ) : (
        <button className="footnote" onClick={() => { setNote(part.note || ''); setEditing(true) }}>
          {part.note ? <>📝 {part.note}</> : <span className="muted">+ 각주 추가</span>}
        </button>
      )}
    </li>
  )
}

export default function Todos({ project, onClose }) {
  const todos = useCollection('todos').filter((t) => t.projectId === project.id).sort(byCreated)
  const parts = useCollection('parts').filter((p) => p.projectId === project.id).sort(byCreated)
  const [todo, setTodo] = useState('')
  const [part, setPart] = useState('')

  const avg = parts.length ? Math.round(parts.reduce((s, p) => s + (p.progress || 0), 0) / parts.length) : 0
  const doneCount = todos.filter((t) => t.done).length

  const addTodo = (e) => {
    e.preventDefault()
    if (!todo.trim()) return
    addItem('todos', { projectId: project.id, title: todo.trim(), done: false })
    setTodo('')
  }
  const addPart = (e) => {
    e.preventDefault()
    if (!part.trim()) return
    addItem('parts', { projectId: project.id, name: part.trim(), progress: 0 })
    setPart('')
  }

  return (
    <div className="page">
      <header className="bar">
        <button className="back" onClick={onClose}>← 뒤로</button>
        <h1>할 일 <small className="sub">{project.name}</small></h1>
      </header>

      <section className="budget">
        <div className="budget-head">
          <h2>투두리스트</h2>
          <strong>{doneCount}/{todos.length}</strong>
        </div>
        <ul className="checklist">
          {todos.map((t) => (
            <li key={t.id} className={t.done ? 'done' : ''}>
              <label>
                <input type="checkbox" checked={!!t.done} onChange={() => updateItem('todos', t.id, { done: !t.done })} />
                <span className="grow">{t.title}</span>
                <button type="button" className="del" onClick={() => removeItem('todos', t.id)} aria-label="삭제">✕</button>
              </label>
            </li>
          ))}
          {todos.length === 0 && <li className="empty">할 일이 없습니다</li>}
        </ul>
        <form className="create" onSubmit={addTodo}>
          <input value={todo} onChange={(e) => setTodo(e.target.value)} placeholder="할 일 추가" />
          <button type="submit">추가</button>
        </form>
      </section>

      <section className="budget">
        <div className="budget-head">
          <h2>설계 데이터 완성도</h2>
          <strong>전체 {avg}%</strong>
        </div>
        <div className="meter" aria-hidden="true"><div className="used done-bar" style={{ width: avg + '%' }} /></div>
        <ul className="parts">
          {parts.map((p) => <PartRow key={p.id} part={p} />)}
          {parts.length === 0 && <li className="empty">설계 데이터 항목이 없습니다</li>}
        </ul>
        <form className="create" onSubmit={addPart}>
          <input value={part} onChange={(e) => setPart(e.target.value)} placeholder="데이터 항목 추가" />
          <button type="submit">추가</button>
        </form>
      </section>
    </div>
  )
}
