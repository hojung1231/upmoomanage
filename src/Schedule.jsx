import { useRef, useState } from 'react'
import { useCollection, addItem, updateItem, removeItem } from './store.js'

const WEEK = ['일', '월', '화', '수', '목', '금', '토']
const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#64748b']

const pad = (n) => String(n).padStart(2, '0')
const key = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`
const shiftKey = (k, n) => { const d = new Date(k + 'T00:00'); d.setDate(d.getDate() + n); return key(d.getFullYear(), d.getMonth(), d.getDate()) }
const diffDays = (a, b) => Math.round((new Date(b + 'T00:00') - new Date(a + 'T00:00')) / 86400000)

export default function Schedule({ project, onClose }) {
  const events = useCollection('events').filter((e) => e.projectId === project.id)
  const now = new Date()
  const todayKey = key(now.getFullYear(), now.getMonth(), now.getDate())
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() })
  const [day, setDay] = useState(todayKey)
  const [title, setTitle] = useState('')
  const [endDate, setEndDate] = useState('')

  const colorOf = () => COLORS[0]
  const meetings = useCollection('meetings')

  // ---- 일정 끌어서 날짜 옮기기 (마우스: 바로 끌기 / 터치: 길게 눌러서 끌기) ----
  const [drag, setDrag] = useState(null) // { ev, x, y, over }
  const dragRef = useRef(null)
  const justDragged = useRef(false)
  const dayAt = (x, y) => document.elementFromPoint(x, y)?.closest('[data-day]')?.dataset.day || null
  const endDrag = () => {
    const d = dragRef.current
    if (d?.timer) clearTimeout(d.timer)
    if (d?.handlers) {
      window.removeEventListener('pointermove', d.handlers.move)
      window.removeEventListener('pointerup', d.handlers.up)
      window.removeEventListener('pointercancel', d.handlers.cancel)
    }
    dragRef.current = null
    setDrag(null)
  }
  const activate = (x, y) => {
    const d = dragRef.current
    if (!d) return
    d.active = true
    navigator.vibrate?.(15)
    setDrag({ ev: d.ev, x, y, over: dayAt(x, y) })
  }
  function onMove(e) {
    const d = dragRef.current
    if (!d) return
    const moved = Math.hypot(e.clientX - d.x0, e.clientY - d.y0)
    if (!d.active) {
      if (d.mouse && moved > 6) activate(e.clientX, e.clientY)
      else if (!d.mouse && moved > 10) endDrag() // 길게 누르기 전에 움직이면 취소
      return
    }
    e.preventDefault()
    setDrag({ ev: d.ev, x: e.clientX, y: e.clientY, over: dayAt(e.clientX, e.clientY) })
  }
  async function onUp(e) {
    const d = dragRef.current
    if (!d?.active) { endDrag(); return }
    const over = dayAt(e.clientX, e.clientY)
    justDragged.current = true
    setTimeout(() => { justDragged.current = false }, 80)
    endDrag()
    if (!over || over === d.from) return
    const n = diffDays(d.from, over)
    const ev = d.ev
    const date = shiftKey(ev.date, n)
    await updateItem('events', ev.id, { date, ...(ev.endDate ? { endDate: shiftKey(ev.endDate, n) } : {}) })
    // 회의 카드와 연결된 일정이면 회의 날짜도 같이 옮김
    for (const m of meetings.filter((m) => m.eventId === ev.id)) updateItem('meetings', m.id, { date })
    setDay(over)
  }
  const onChipDown = (e, ev, k) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    e.stopPropagation()
    endDrag()
    const d = { ev, from: k, x0: e.clientX, y0: e.clientY, active: false, mouse: e.pointerType === 'mouse' }
    if (!d.mouse) d.timer = setTimeout(() => activate(d.x0, d.y0), 300)
    d.handlers = { move: onMove, up: onUp, cancel: endDrag }
    dragRef.current = d
    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', endDrag)
  }

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
              data-day={k}
              className={'cell' + (k === day ? ' sel' : '') + (k === todayKey ? ' today' : '') + (drag?.over === k ? ' drop' : '')}
              onClick={() => { if (!justDragged.current) setDay(k) }}
            >
              <span className={'num' + (dow === 0 ? ' sun' : dow === 6 ? ' sat' : '')}>{d}</span>
              {list.slice(0, 3).map((ev) => (
                <span
                  key={ev.id}
                  className={'chip' + (ev.endDate ? ' span' : '') + (drag?.ev.id === ev.id ? ' dragging' : '')}
                  style={{ background: colorOf(ev.projectId) }}
                  onPointerDown={(e) => onChipDown(e, ev, k)}
                  onContextMenu={(e) => e.preventDefault()}
                  title="끌어서 날짜 옮기기"
                >
                  {ev.title}
                </span>
              ))}
              {list.length > 3 && <span className="more">+{list.length - 3}</span>}
            </button>
          )
        })}
      </div>

      {drag && (
        <div className="drag-ghost" style={{ left: drag.x, top: drag.y }}>
          {drag.ev.title}{drag.over && <small> → {md(shiftKey(drag.ev.date, diffDays(dragRef.current?.from || drag.ev.date, drag.over)))}</small>}
        </div>
      )}
      <p className="hint center cal-hint">일정을 끌어다 다른 날짜에 놓으면 옮겨집니다 (폰은 길게 누른 뒤 끌기)</p>

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
