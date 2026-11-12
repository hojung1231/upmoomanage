import { useState } from 'react'
import { useCollection, addItem, syncEnabled } from './store.js'
import Schedule from './Schedule.jsx'

export default function App() {
  const projects = useCollection('projects')
  const [screen, setScreen] = useState('home') // 'home' | 'schedule' | 'project'
  const [selectedId, setSelectedId] = useState(null)
  const [name, setName] = useState('')

  const sorted = [...projects].sort((a, b) => a.createdAt - b.createdAt)
  const selected = projects.find((p) => p.id === selectedId)

  const create = (e) => {
    e.preventDefault()
    const n = name.trim()
    if (!n) return
    addItem('projects', { name: n })
    setName('')
  }

  if (screen === 'schedule') {
    return <Schedule projects={sorted} onClose={() => setScreen('home')} />
  }

  if (screen === 'project' && selected) {
    return (
      <div className="page">
        <header className="bar">
          <button className="back" onClick={() => setScreen('home')}>← 뒤로</button>
          <h1>{selected.name}</h1>
        </header>
      </div>
    )
  }

  return (
    <div className="page">
      <button className="schedule-btn" onClick={() => setScreen('schedule')}>
        📅 스케줄
      </button>

      <form className="create" onSubmit={create}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="새 프로젝트 이름"
        />
        <button type="submit">만들기</button>
      </form>

      <ul className="projects">
        {sorted.map((p) => (
          <li key={p.id}>
            <button onClick={() => { setSelectedId(p.id); setScreen('project') }}>
              {p.name}
            </button>
          </li>
        ))}
        {sorted.length === 0 && <li className="empty">프로젝트를 만들어 주세요</li>}
      </ul>

      {!syncEnabled && <p className="note">연동 설정 전: 이 기기에만 저장됩니다</p>}
    </div>
  )
}
