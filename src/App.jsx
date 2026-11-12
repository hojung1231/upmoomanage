import { useEffect, useState } from 'react'
import { useCollection, addItem, ensureSeed, syncEnabled } from './store.js'
import Project from './Project.jsx'
import UpdatePopup from './UpdatePopup.jsx'

export default function App() {
  const projects = useCollection('projects')
  const [screen, setScreen] = useState('home') // 'home' | 'project'
  const [selectedId, setSelectedId] = useState(null)
  const [name, setName] = useState('')
  const [adding, setAdding] = useState(false)

  useEffect(() => { ensureSeed() }, [])

  const sorted = [...projects].sort((a, b) => a.createdAt - b.createdAt)
  const selected = projects.find((p) => p.id === selectedId)

  const create = (e) => {
    e.preventDefault()
    const n = name.trim()
    if (!n) return
    addItem('projects', { name: n })
    setName('')
    setAdding(false)
  }

  let content
  if (screen === 'project' && selected) {
    content = <Project project={selected} onBack={() => setScreen('home')} />
  } else {
    content = (
      <div className="page">
        <header className="bar home-bar">
          <h1>프로젝트</h1>
          <button className="plus" onClick={() => setAdding(!adding)} aria-label="새 프로젝트">+</button>
        </header>

        {adding && (
          <form className="create" onSubmit={create}>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="새 프로젝트 이름"
            />
            <button type="submit">만들기</button>
          </form>
        )}

        <ul className="projects">
          {sorted.map((p) => (
            <li key={p.id}>
              <button onClick={() => { setSelectedId(p.id); setScreen('project') }}>
                {p.name}
              </button>
            </li>
          ))}
          {sorted.length === 0 && <li className="empty">+ 버튼으로 프로젝트를 만들어 주세요</li>}
        </ul>

        {!syncEnabled && <p className="note">연동 설정 전: 이 기기에만 저장됩니다</p>}
        <p className="note">버전 {__APP_VERSION__}</p>
      </div>
    )
  }

  return (
    <>
      {content}
      <UpdatePopup />
    </>
  )
}
