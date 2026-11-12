import { useState } from 'react'
import { useCollection, addItem, removeItem } from './store.js'

const WEEK = ['일', '월', '화', '수', '목', '금', '토']
const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#64748b']

const pad = (n) => String(n).padStart(2, '0')
const key = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`

export default function Schedule({ project, onClose }) {
  const events = useCollection('events').filter((e) => e.projectId === project.id)
  const now = new Date()
  const todayKey = key(now.getFullYear(), now.getMonth(), now.getDate())
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() })
  const [day, setDay] = useState(todayKey)
  const [title, setTitle] = useState('')
  const [endDate, setEndDate] = useState('')

  const colorOf = () => COLORS[0]

  // 기간 일정(endDate)은 시작~끝 사이 모든 날짜에 표시
  const byDay = {}
  for (const e of events) {
    const end = e.endDate && e.endDate > e.date ? e.endDate : e.date
    const d = new Date(e.date + 'T00:00')
    for (let k = e.date; k <= end; ) {
      ;(byDay[k] ||= []).push(e)
      d.setDate(d.getDate() + 1)
      k = key(d.getFullYear(), d.getMonth(), d.getDate())
    }
  }
  for (const k in byDay) byDay[k].sort((a, b) => a.createdAt - b.createdAt)

  const first = new Date(ym.y, ym.m, 1).getDay()
  const days = new Date(ym.y, ym.m + 1, 0).getDate()
  const cells = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)]
  while (cells.length % 7) cells.push(null)

  const move = (delta) => {
    const d = new Date(ym.y, ym.m + delta, 1)
    setYm({ y: d.getFullYear(), m: d.getMonth() })
  }
  const goToday = () => { setYm({ y: now.getFullYear(), m: now.getMonth() }); setDay(todayKey) }

  const add = (e) => {
    e.preventDefault()
    const t = title.trim()
    if (!t) return
    addItem('events', { date: day, title: t, projectId: project.id, ...(endDate > day ? { endDate } : {}) })
    setTitle('')
    setEndDate('')
  }

  const dayEvents = byDay[day] || []
  const [dy, dm, dd] = day.split('-').map(Number)
  const md = (k) => { const [, m, d] = k.split('-').map(Number); return `${m}/${d}` }
  const dayLabel = `${dm}월 ${dd}일 (${WEEK[new Date(dy, dm - 1, dd).getDay()]})`

  return (
    <div className="page schedule">
      <header className="bar">
        <button className="back" onClick={onClose} aria-label="뒤로">‹</button>
        <h1>스케줄 <small className="sub">{project.name}</small></h1>
      </header>

      <div className="month-nav">
        <button onClick={() => move(-1)} aria-label="이전 달">‹</button>
        <strong>{ym.y}년 {ym.m + 1}월</strong>
        <button onClick={() => move(1)} aria-label="다음 달">›</button>
        <button className="today" onClick={goToday}>오늘</button>
      </div>

      <div className="cal">
        {WEEK.map((w, i) => (
          <div key={w} className={'wk' + (i === 0 ? ' sun' : i === 6 ? ' sat' : '')}>{w}</div>
        ))}
        {cells.map((d, i) => {
          if (!d) return <div key={i} className="cell blank" />
          const k = key(ym.y, ym.m, d)
          const list = byDay[k] || []
          const dow = i % 7
          return (
            <button
              key={i}
              className={'cell' + (k === day ? ' sel' : '') + (k === todayKey ? ' today' : '')}
              onClick={() => setDay(k)}
            >
              <span className={'num' + (dow === 0 ? ' sun' : dow === 6 ? ' sat' : '')}>{d}</span>
              {list.slice(0, 3).map((ev) => (
                <span key={ev.id} className={'chip' + (ev.endDate ? ' span' : '')} style={{ background: colorOf(ev.projectId) }}>
                  {ev.title}
                </span>
              ))}
              {list.length > 3 && <span className="more">+{list.length - 3}</span>}
            </button>
          )
        })}
      </div>

      <section className="day">
        <h2>{dayLabel}</h2>
        <ul>
          {dayEvents.map((ev) => (
            <li key={ev.id}>
              <span className="dot" style={{ background: colorOf(ev.projectId) }} />
              <span className="t">
                {ev.title}
                {ev.endDate && <span className="range"> {md(ev.date)} ~ {md(ev.endDate)}</span>}
              </span>
              <button className="del" onClick={() => removeItem('events', ev.id)} aria-label="삭제">✕</button>
            </li>
          ))}
          {dayEvents.length === 0 && <li className="empty">일정 없음</li>}
        </ul>
        <form className="create" onSubmit={add}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="일정 추가" />
          <label className="until">
            ~ 종료일
            <input type="date" value={endDate} min={day} onChange={(e) => setEndDate(e.target.value)} />
          </label>
          <button type="submit">추가</button>
        </form>
      </section>
    </div>
  )
}
