import { useState } from 'react'
import Schedule from './Schedule.jsx'
import Budget from './Budget.jsx'
import Notes from './Notes.jsx'

export default function Project({ project, onBack, initialView = null, openNoteId = null }) {
  const [view, setView] = useState(initialView) // null | 'schedule' | 'budget' | 'notes'
  const close = () => setView(null)

  if (view === 'schedule') return <Schedule project={project} onClose={close} />
  if (view === 'budget') return <Budget project={project} onClose={close} />
  if (view === 'notes') return <Notes project={project} onClose={close} openId={openNoteId} />

  return (
    <div className="page">
      <header className="bar">
        <button className="back" onClick={onBack}>← 뒤로</button>
        <h1>{project.name}</h1>
      </header>

      <button className="schedule-btn" onClick={() => setView('schedule')}>📅 스케줄</button>
      <button className="schedule-btn second" onClick={() => setView('budget')}>💰 사업비</button>
      <button className="schedule-btn third" onClick={() => setView('notes')}>🎙 회의록</button>
    </div>
  )
}
