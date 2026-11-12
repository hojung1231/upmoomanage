import { useState } from 'react'
import { useCollection } from './store.js'
import Schedule from './Schedule.jsx'
import Budget from './Budget.jsx'
import Notes from './Notes.jsx'
import Todos from './Todos.jsx'
import Data from './Data.jsx'

const won = (n) => {
  const v = Math.round(n || 0)
  if (Math.abs(v) >= 1e8) return (v / 1e8).toFixed(2).replace(/\.?0+$/, '') + '억'
  if (Math.abs(v) >= 1e4) return Math.round(v / 1e4).toLocaleString('ko-KR') + '만'
  return v.toLocaleString('ko-KR')
}
const todayKey = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10)
const md = (k) => `${Number(k.slice(5, 7))}/${Number(k.slice(8))}`

export default function Project({ project, onBack, initialView = null, openNoteId = null }) {
  const [view, setView] = useState(initialView)
  const close = () => setView(null)
  const mine = (list) => list.filter((x) => x.projectId === project.id)

  const events = mine(useCollection('events'))
  const expenses = mine(useCollection('expenses'))
  const todos = mine(useCollection('todos'))
  const parts = mine(useCollection('parts'))
  const notes = mine(useCollection('notes'))

  if (view === 'schedule') return <Schedule project={project} onClose={close} />
  if (view === 'budget') return <Budget project={project} onClose={close} />
  if (view === 'todos') return <Todos project={project} onClose={close} />
  if (view === 'data') return <Data project={project} onClose={close} />
  if (view === 'notes') return <Notes project={project} onClose={close} openId={openNoteId} />

  // 타일 한 줄 요약
  const today = todayKey()
  const next = events
    .filter((e) => (e.endDate || e.date) >= today)
    .sort((a, b) => a.date.localeCompare(b.date))[0]
  const b = project.budget || {}
  const total = (b.advance || 0) + (b.interim || 0) + (b.balance || 0)
  const spent = expenses.filter((e) => e.type === 'spent').reduce((s, e) => s + (e.amount || 0), 0)
  const avg = parts.length ? Math.round(parts.reduce((s, p) => s + (p.progress || 0), 0) / parts.length) : 0
  const pendingNotes = notes.filter((n) => (n.schedules || []).some((s) => s.status === 'pending')).length

  const tiles = [
    { id: 'schedule', icon: '📅', label: '스케줄', sub: next ? `${md(next.date)} ${next.title}` : '예정 없음' },
    { id: 'budget', icon: '💰', label: '사업비', sub: `잔액 ${won(total - spent)}원` },
    { id: 'todos', icon: '✅', label: '할 일', sub: todos.length ? `${todos.filter((t) => t.done).length}/${todos.length} 완료` : '없음' },
    { id: 'data', icon: '📐', label: '데이터', sub: parts.length ? `완성도 ${avg}%` : '없음' },
    { id: 'notes', icon: '🎙', label: '회의록', sub: pendingNotes ? `확인 필요 ${pendingNotes}건` : `${notes.length}건` },
  ]

  return (
    <div className="page">
      <header className="bar">
        <button className="back" onClick={onBack} aria-label="뒤로">‹</button>
        <h1>{project.name}</h1>
      </header>

      <div className="tiles">
        {tiles.map((t) => (
          <button key={t.id} className="tile" onClick={() => setView(t.id)}>
            <span className="tile-icon" aria-hidden="true">{t.icon}</span>
            <span className="tile-label">{t.label}</span>
            <span className="tile-sub">{t.sub}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
