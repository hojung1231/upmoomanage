// 예정된 회의: 회의 전에 말할 것(안건), 메모, 문서, 사진을 준비해 두는 카드
import { useEffect, useState } from 'react'
import { useCollection, addItem, updateItem, removeItem, saveFile, fileBlob, removeFile } from './store.js'
import { shrink, useDrop, pastedImages, fmtSize } from './media.js'

const WEEK = ['일', '월', '화', '수', '목', '금', '토']
export const todayKey = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10)
export const dayLabel = (k) => {
  const [y, m, d] = k.split('-').map(Number)
  return `${m}/${d} (${WEEK[new Date(y, m - 1, d).getDay()]})`
}
const whenText = (mt) => `${dayLabel(mt.date)}${mt.time ? ' ' + mt.time : ''}`

// 회의록 목록 위에 보이는 회의 카드 목록 + 새 회의 추가
export function MeetingList({ project, onOpen }) {
  const meetings = useCollection('meetings').filter((m) => m.projectId === project.id)
    .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))
  const files = useCollection('files').filter((f) => f.projectId === project.id && f.meetingId)
  const photos = useCollection('photos').filter((p) => p.projectId === project.id && p.meetingId)
  const [adding, setAdding] = useState(false)
  const [showPast, setShowPast] = useState(false)
  const today = todayKey()
  const upcoming = meetings.filter((m) => m.date >= today)
  const past = meetings.filter((m) => m.date < today).reverse()

  const card = (m) => {
    const agenda = m.agenda || []
    const nFiles = files.filter((f) => f.meetingId === m.id).length + photos.filter((p) => p.meetingId === m.id).length
    return (
      <li key={m.id} className={'meet-card' + (m.date === today ? ' today' : '') + (m.date < today ? ' past' : '')}>
        <button onClick={() => onOpen(m.id)}>
          <span className="meet-when">{m.date === today ? '오늘 ' : ''}{whenText(m)}</span>
          <strong>{m.title}</strong>
          <small className="sub">
            말할 것 {agenda.length}개{agenda.length ? ` (${agenda.filter((a) => a.done).length} 완료)` : ''} · 자료 {nFiles}개{m.memo ? ' · 메모 있음' : ''}
          </small>
        </button>
      </li>
    )
  }

  return (
    <section className="card meet-box">
      <div className="card-head">
        <h2>예정된 회의</h2>
        {!adding && <button onClick={() => setAdding(true)}>+ 회의</button>}
      </div>
      {adding && <NewMeeting project={project} onDone={(id) => { setAdding(false); if (id) onOpen(id) }} />}
      <ul className="meet-list">
        {upcoming.map(card)}
        {upcoming.length === 0 && !adding && <li className="empty">예정된 회의가 없습니다</li>}
      </ul>
      {past.length > 0 && (
        <>
          <button className="link" onClick={() => setShowPast(!showPast)}>{showPast ? '지난 회의 숨기기' : `지난 회의 ${past.length}개 보기`}</button>
          {showPast && <ul className="meet-list">{past.map(card)}</ul>}
        </>
      )}
    </section>
  )
}

function NewMeeting({ project, onDone }) {
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(todayKey())
  const [time, setTime] = useState('')
  const [toSchedule, setToSchedule] = useState(true)
  const save = async (e) => {
    e.preventDefault()
    if (!title.trim() || !date) return
    let eventId = ''
    if (toSchedule) {
      eventId = await addItem('events', { projectId: project.id, date, title: `${time ? time + ' ' : ''}${title.trim()}` })
    }
    const id = await addItem('meetings', { projectId: project.id, title: title.trim(), date, time, agenda: [], memo: '', eventId })
    onDone(id)
  }
  return (
    <form className="meet-new" onSubmit={save}>
      <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="회의 이름 (예: KH 설계 착수 회의)" />
      <div className="row">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="날짜" />
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="시간" />
      </div>
      <label className="chk"><input type="checkbox" checked={toSchedule} onChange={(e) => setToSchedule(e.target.checked)} /> 스케줄에도 등록</label>
      <div className="bactions">
        <button type="button" onClick={() => onDone(null)}>취소</button>
        <button type="submit" className="primary" disabled={!title.trim() || !date}>추가</button>
      </div>
    </form>
  )
}

// 회의 상세: 말할 것 / 메모 / 문서 / 사진
export function MeetingDetail({ meeting: mt, project, onBack }) {
  const files = useCollection('files').filter((f) => f.meetingId === mt.id).sort((a, b) => a.createdAt - b.createdAt)
  const photos = useCollection('photos').filter((p) => p.meetingId === mt.id).sort((a, b) => a.createdAt - b.createdAt)
  const agenda = mt.agenda || []
  const [item, setItem] = useState('')
  const [memo, setMemo] = useState(mt.memo || '')
  const [editHead, setEditHead] = useState(false)
  const [head, setHead] = useState({ title: mt.title, date: mt.date, time: mt.time || '' })
  const [busy, setBusy] = useState('')
  const [view, setView] = useState(null)
  const [editIdx, setEditIdx] = useState(-1)
  const [editText, setEditText] = useState('')

  useEffect(() => setMemo(mt.memo || ''), [mt.memo])

  const setAgenda = (next) => updateItem('meetings', mt.id, { agenda: next })
  const addAgenda = (e) => {
    e.preventDefault()
    const lines = item.split('\n').map((s) => s.trim()).filter(Boolean)
    if (!lines.length) return
    setAgenda([...agenda, ...lines.map((text) => ({ text, done: false }))])
    setItem('')
  }

  const addPhotos = async (list) => {
    setBusy('사진 올리는 중…')
    try {
      for (const f of list) await addItem('photos', { projectId: project.id, meetingId: mt.id, data: await shrink(f) })
    } catch (err) { alert(err.message) }
    setBusy('')
  }
  const addDocs = async (list) => {
    const imgs = list.filter((f) => f.type.startsWith('image/'))
    const docs = list.filter((f) => !f.type.startsWith('image/'))
    if (imgs.length) await addPhotos(imgs)
    for (const f of docs) {
      setBusy(`"${f.name}" 올리는 중…`)
      try { await saveFile({ projectId: project.id, meetingId: mt.id }, f) } catch (err) { alert(err.message) }
    }
    setBusy('')
  }
  const [over, dropProps] = useDrop(addDocs, false)

  // 이 화면에서 Ctrl+V 하면 클립보드 이미지를 사진에 추가
  useEffect(() => {
    const onPaste = (e) => {
      const f = pastedImages(e)
      if (!f.length) return
      e.preventDefault()
      addPhotos(f)
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  })

  const openDoc = async (f) => {
    setBusy(`"${f.name}" 여는 중…`)
    try {
      const url = URL.createObjectURL(await fileBlob(f))
      const a = document.createElement('a')
      a.href = url
      a.download = f.name
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (err) { alert('파일을 열지 못했습니다') }
    setBusy('')
  }

  const saveHead = async () => {
    if (!head.title.trim() || !head.date) return
    await updateItem('meetings', mt.id, { title: head.title.trim(), date: head.date, time: head.time })
    if (mt.eventId) {
      try {
        await updateItem('events', mt.eventId, { date: head.date, title: `${head.time ? head.time + ' ' : ''}${head.title.trim()}` })
      } catch {}
    }
    setEditHead(false)
  }

  const del = async () => {
    if (!confirm(`"${mt.title}" 회의 카드와 첨부 자료를 삭제할까요?`)) return
    for (const f of files) await removeFile(f)
    for (const p of photos) await removeItem('photos', p.id)
    await removeItem('meetings', mt.id)
    onBack()
  }

  return (
    <div className={'page' + (over ? ' drop-over' : '')} {...dropProps}>
      <header className="bar">
        <button className="back" onClick={onBack} aria-label="뒤로">‹</button>
        <h1>{mt.title} <small className="sub">{whenText(mt)}</small></h1>
      </header>

      {editHead ? (
        <section className="card meet-new">
          <input value={head.title} onChange={(e) => setHead({ ...head, title: e.target.value })} placeholder="회의 이름" />
          <div className="row">
            <input type="date" value={head.date} onChange={(e) => setHead({ ...head, date: e.target.value })} />
            <input type="time" value={head.time} onChange={(e) => setHead({ ...head, time: e.target.value })} />
          </div>
          {mt.eventId && <p className="hint">스케줄의 일정도 같이 바뀝니다</p>}
          <div className="bactions">
            <button onClick={() => setEditHead(false)}>취소</button>
            <button className="primary" onClick={saveHead}>저장</button>
          </div>
        </section>
      ) : (
        <button className="meet-head" onClick={() => { setHead({ title: mt.title, date: mt.date, time: mt.time || '' }); setEditHead(true) }}>
          📅 {whenText(mt)}{mt.time ? '' : ' · 시간 미정'} <span className="muted">· 눌러서 이름·날짜·시간 수정</span>
        </button>
      )}

      <section className="card">
        <div className="card-head">
          <h2>회의 때 말할 것</h2>
          <span className="count">{agenda.filter((a) => a.done).length}/{agenda.length}</span>
        </div>
        <ul className="checklist">
          {agenda.map((a, i) => (
            <li key={i} className={'check-row' + (a.done ? ' done' : '')}>
              {editIdx === i ? (
                <form className="agenda-edit" onSubmit={(e) => { e.preventDefault(); setAgenda(agenda.map((x, j) => (j === i ? { ...x, text: editText.trim() || x.text } : x))); setEditIdx(-1) }}>
                  <input autoFocus value={editText} onChange={(e) => setEditText(e.target.value)} onBlur={(e) => e.currentTarget.form.requestSubmit()} />
                </form>
              ) : (
                <>
                  <input type="checkbox" checked={a.done} onChange={() => setAgenda(agenda.map((x, j) => (j === i ? { ...x, done: !x.done } : x)))} aria-label="말함" />
                  <span className="agenda-text" onClick={() => { setEditIdx(i); setEditText(a.text) }}>{a.text}</span>
                  <button className="del" onClick={() => setAgenda(agenda.filter((_, j) => j !== i))} aria-label="삭제">✕</button>
                </>
              )}
            </li>
          ))}
          {agenda.length === 0 && <li className="empty">말할 것을 적어두세요</li>}
        </ul>
        <form className="create" onSubmit={addAgenda}>
          <input value={item} onChange={(e) => setItem(e.target.value)} placeholder="말할 것 추가" />
          <button type="submit">추가</button>
        </form>
      </section>

      <section className="card">
        <div className="card-head"><h2>메모</h2>{memo !== (mt.memo || '') && <span className="count">입력 중…</span>}</div>
        <textarea
          className="meet-memo"
          rows={5}
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          onBlur={() => memo !== (mt.memo || '') && updateItem('meetings', mt.id, { memo })}
          placeholder="회의 준비 메모, 참고 내용 등 (칸 밖을 누르면 저장)"
        />
      </section>

      <section className="card">
        <div className="card-head">
          <h2>자료</h2>
          <label className="pick">📎 문서·파일<input type="file" multiple onChange={(e) => { const f = [...e.target.files]; e.target.value = ''; addDocs(f) }} hidden /></label>
        </div>
        <ul className="files">
          {files.map((f) => (
            <li key={f.id}>
              <button className="file-name" onClick={() => openDoc(f)}>📄 {f.name}</button>
              <span className="muted">{fmtSize(f.size)}</span>
              <button className="del" onClick={() => { if (confirm(`"${f.name}" 을 삭제할까요?`)) removeFile(f) }} aria-label="삭제">✕</button>
            </li>
          ))}
          {files.length === 0 && <li className="empty">PPT·PDF·엑셀·텍스트 파일을 올려두세요 (20MB까지)</li>}
        </ul>

        <div className="card-head photo-head">
          <h2>사진</h2>
          <label className="pick">📷 사진<input type="file" accept="image/*" multiple onChange={(e) => { const f = [...e.target.files]; e.target.value = ''; addPhotos(f) }} hidden /></label>
        </div>
        {photos.length > 0 ? (
          <div className="thumbs">
            {photos.map((p) => (
              <span key={p.id} className="thumb-edit">
                <img src={p.data} alt="" onClick={() => setView(p.data)} />
                <button onClick={() => { if (confirm('이 사진을 삭제할까요?')) removeItem('photos', p.id) }} aria-label="사진 삭제">✕</button>
              </span>
            ))}
          </div>
        ) : <p className="hint">사진·스크린샷 (Ctrl+V로 붙여넣기 가능)</p>}
        {busy && <p className="hint">{busy}</p>}
        <p className="hint">파일을 이 화면에 끌어다 놓아도 올라갑니다</p>
      </section>

      <div className="bactions">
        <button onClick={del}>회의 삭제</button>
      </div>

      {view && <div className="viewer" onClick={() => setView(null)}><img src={view} alt="" /></div>}
    </div>
  )
}
