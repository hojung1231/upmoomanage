import { useEffect, useState } from 'react'
import { useCollection, addItem, ensureSeed, syncEnabled } from './store.js'
import Project from './Project.jsx'
import UpdatePopup from './UpdatePopup.jsx'
import { saveNote } from './Notes.jsx'

// 공유하기로 들어온 텍스트(서비스워커가 보관) 꺼내기
async function takeShared() {
  if (!new URLSearchParams(location.search).has('share')) return null
  history.replaceState(null, '', location.pathname)
  try {
    const cache = await caches.open('share')
    const res = await cache.match('shared-data')
    if (!res) return null
    await cache.delete('shared-data')
    const d = await res.json()
    const fileText = (d.files || []).map((f) => f.text).join('\n\n')
    const text = (fileText || d.text || '').trim()
    if (!text) return null
    const name = (d.files?.[0]?.name || d.title || '회의록').replace(/\.txt$/i, '')
    return { text, name }
  } catch {
    return null
  }
}

export default function App() {
  const projects = useCollection('projects')
  const [screen, setScreen] = useState('home') // 'home' | 'project'
  const [selectedId, setSelectedId] = useState(null)
  const [name, setName] = useState('')
  const [adding, setAdding] = useState(false)
  const [shared, setShared] = useState(null)
  const [opened, setOpened] = useState(null) // 공유 저장 후 바로 열 회의록

  useEffect(() => {
    ensureSeed()
    takeShared().then((s) => s && setShared(s))
  }, [])

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

  const saveShared = async (p) => {
    const s = shared
    setShared(null)
    setSelectedId(p.id)
    setScreen('project')
    const noteId = await saveNote(p, s.text, s.name)
    setOpened({ projectId: p.id, noteId })
  }

  let content
  if (shared) {
    content = (
      <div className="page">
        <header className="bar">
          <button className="back" onClick={() => setShared(null)} aria-label="취소">‹</button>
          <h1>회의록 받기</h1>
        </header>
        <p className="hint">어느 프로젝트에 넣을까요?</p>
        <ul className="projects">
          {sorted.map((p) => (
            <li key={p.id}><button onClick={() => saveShared(p)}>{p.name}</button></li>
          ))}
        </ul>
        <section className="card">
          <h2>{shared.name}</h2>
          <pre className="raw">{shared.text.slice(0, 600)}{shared.text.length > 600 ? '…' : ''}</pre>
        </section>
      </div>
    )
  } else if (screen === 'project' && selected) {
    const open = opened && opened.projectId === selected.id ? opened : null
    content = (
      <Project
        key={open ? open.noteId : selected.id}
        project={selected}
        onBack={() => { setOpened(null); setScreen('home') }}
        initialView={open ? 'notes' : null}
        openNoteId={open?.noteId}
      />
    )
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
