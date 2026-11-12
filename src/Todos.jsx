import { useState } from 'react'
import { useCollection, addItem, updateItem, removeItem } from './store.js'

const WEEK = ['일', '월', '화', '수', '목', '금', '토']
const todayKey = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10)
const label = (k) => {
  const [y, m, d] = k.split('-').map(Number)
  return `${m}/${d} (${WEEK[new Date(y, m - 1, d).getDay()]})`
}
// 미완료 먼저, 그 안에서 날짜 있는 것(빠른 순) → 날짜 없는 것
const order = (a, b) =>
  (a.done ? 1 : 0) - (b.done ? 1 : 0) ||
  (a.date ? 0 : 1) - (b.date ? 0 : 1) ||
  (a.date || '').localeCompare(b.date || '') ||
  a.createdAt - b.createdAt

function TodoRow({ t, today }) {
  const [editDate, setEditDate] = useState(false)
  const overdue = !t.done && t.date && t.date < today
  return (
    <li className={'todo' + (t.done ? ' done' : '')}>
      <input type="checkbox" checked={!!t.done} onChange={() => updateItem('todos', t.id, { done: !t.done })} aria-label="완료" />
      <span className="todo-title">{t.title}</span>
      {editDate ? (
        <input
          type="date"
          className="todo-date-input"
          autoFocus
          value={t.date || ''}
          onChange={(e) => updateItem('todos', t.id, { date: e.target.value })}
          onBlur={() => setEditDate(false)}
        />
      ) : (
        <button className={'date-chip' + (overdue ? ' over' : t.date === today ? ' today' : '')} onClick={() => setEditDate(true)}>
          {t.date ? label(t.date) : '날짜'}
        </button>
      )}
      <button className="del" onClick={() => removeItem('todos', t.id)} aria-label="삭제">✕</button>
    </li>
  )
}

export default function Todos({ project, onClose }) {
  const todos = useCollection('todos').filter((t) => t.projectId === project.id).sort(order)
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const today = todayKey()
  const doneCount = todos.filter((t) => t.done).length

  const add = (e) => {
    e.preventDefault()
    if (!title.trim()) return
    addItem('todos', { projectId: project.id, title: title.trim(), done: false, date })
    setTitle('')
    setDate('')
  }

  return (
    <div className="page">
      <header className="bar">
        <button className="back" onClick={onClose} aria-label="뒤로">‹</button>
        <h1>할 일 <small className="sub">{project.name}</small></h1>
      </header>

      <section className="card">
        <div className="card-head">
          <h2>투두리스트</h2>
          <span className="count">{doneCount}/{todos.length}</span>
        </div>
        <ul className="todos">
          {todos.map((t) => <TodoRow key={t.id} t={t} today={today} />)}
          {todos.length === 0 && <li className="empty">할 일이 없습니다</li>}
        </ul>
        <form className="create two-row" onSubmit={add}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="할 일 추가" />
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="날짜" />
          <button type="submit">추가</button>
        </form>
      </section>
    </div>
  )
}
