import { useState } from 'react'
import Schedule from './Schedule.jsx'
import Budget from './Budget.jsx'

export default function Project({ project, onBack }) {
  const [view, setView] = useState(null) // null | 'schedule' | 'budget'
  const close = () => setView(null)

  if (view === 'schedule') return <Schedule project={project} onClose={close} />
  if (view === 'budget') return <Budget project={project} onClose={close} />

  return (
    <div className="page">
      <header className="bar">
        <button className="back" onClick={onBack}>← 뒤로</button>
        <h1>{project.name}</h1>
      </header>

      <button className="schedule-btn" onClick={() => setView('schedule')}>📅 스케줄</button>
      <button className="schedule-btn second" onClick={() => setView('budget')}>💰 사업비</button>
    </div>
  )
}
