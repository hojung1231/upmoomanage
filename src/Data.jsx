import { useEffect, useRef, useState } from 'react'
import { useCollection, addItem, updateItem, removeItem } from './store.js'
import { shrink, useDrop, pastedImages } from './media.js'

const byCreated = (a, b) => a.createdAt - b.createdAt
const PART_STATUS = ['시작 전', '진행중', '검토중', '완료']
const REQ_STATUS = ['요청', '진행중', '완료']
const statusClass = (s) => ({ '진행중': 'st-doing', '검토중': 'st-review', '완료': 'st-done' }[s] || 'st-wait')
const fmtDate = (t) => {
  const d = new Date(t)
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`
}
const cycle = (list, cur) => list[(list.indexOf(cur) + 1) % list.length]

// PC 폴더 바로 열기: 설정 파일을 실행한 PC에서만 upmu-folder: 링크가 탐색기를 연다
const OPENER_KEY = 'upmu:folderOpener'
export const hasOpener = () => { try { return localStorage.getItem(OPENER_KEY) === '1' } catch { return false } }
export const setOpener = (on) => { try { on ? localStorage.setItem(OPENER_KEY, '1') : localStorage.removeItem(OPENER_KEY) } catch {} }

const touch = (partId) => updateItem('parts', partId, { updatedAt: Date.now() })

// Ctrl+V 붙여넣기 대상: 선택된 수정요청 id → 스크린샷 추가 함수
const pasteTargets = new Map()

function Request({ r, photos, onView, selected, onSelect }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState("")
  const [busy, setBusy] = useState(false)
  const saveText = () => {
    updateItem("requests", r.id, { text: draft.trim(), updatedAt: Date.now() })
    touch(r.partId)
    setEditing(false)
  }
  const addShots = async (files) => {
    if (!files.length) return
    setBusy(true)
    try {
      for (const f of files) {
        const data = await shrink(f)
        await addItem("photos", { projectId: r.projectId, partId: r.partId, requestId: r.id, data })
      }
      updateItem("requests", r.id, { updatedAt: Date.now() })
      touch(r.partId)
    } catch (err) { alert(err.message) }
    setBusy(false)
  }
  const pick = (e) => { const f = [...(e.target.files || [])]; e.target.value = ""; addShots(f) }
  useEffect(() => { pasteTargets.set(r.id, addShots); return () => pasteTargets.delete(r.id) })
  const [over, dropProps] = useDrop(addShots)
  const delShot = (p) => { if (confirm("이 스크린샷을 삭제할까요?")) { removeItem("photos", p.id); touch(r.partId) } }
  const setStatus = () => {
    updateItem("requests", r.id, { status: cycle(REQ_STATUS, r.status || "요청"), updatedAt: Date.now() })
    touch(r.partId)
  }
  const del = () => {
    if (!confirm("이 수정요청을 삭제할까요?")) return
    photos.forEach((p) => removeItem("photos", p.id))
    removeItem("requests", r.id)
    touch(r.partId)
  }
  return (
    <li className={"req" + (r.status === "완료" ? " done" : "") + (over ? " drop-over" : "") + (selected ? " selected" : "")} onClick={() => onSelect(r.id)} {...dropProps}>
      <div className="req-head">
        <button className={"badge " + statusClass(r.status || "요청")} onClick={setStatus} title="눌러서 상태 변경">{r.status || "요청"}</button>
        <span className="req-date">{fmtDate(r.updatedAt || r.createdAt)}</span>
        <label className="shot-add" title="스크린샷·사진 추가 (PC는 이 항목에 끌어다 놓거나 Ctrl+V)">
          {busy ? "올리는 중…" : "🖼 추가"}
          <input type="file" accept="image/*" multiple onChange={pick} hidden />
        </label>
        <button className="del" onClick={del} aria-label="수정요청 삭제">✕</button>
      </div>
      {editing ? (
        <div className="note-edit">
          <textarea autoFocus rows={3} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="수정요청 내용 (스크린샷은 끌어다 놓거나 Ctrl+V)" />
          <div className="bactions">
            <button onClick={() => setEditing(false)}>취소</button>
            <button className="primary" onClick={saveText}>저장</button>
          </div>
        </div>
      ) : (
        <button className="req-text" onClick={() => { setDraft(r.text || ""); setEditing(true) }} title="눌러서 수정">
          {r.text || <span className="muted">+ 내용 추가</span>}
        </button>
      )}
      {selected && <p className="paste-hint">{busy ? "스크린샷 올리는 중…" : "📋 Ctrl+V 로 클립보드 스크린샷 붙여넣기"}</p>}
      {photos.length > 0 && (
        <div className="thumbs">
          {photos.map((p) => (
            <span key={p.id} className="thumb-edit">
              <img src={p.data} alt="" onClick={() => onView(p.data)} />
              <button onClick={() => delShot(p)} aria-label="스크린샷 삭제">✕</button>
            </span>
          ))}
        </div>
      )}
    </li>
  )
}

function NewRequest({ part, onDone }) {
  const [text, setText] = useState('')
  const [pics, setPics] = useState([]) // data URL
  const [busy, setBusy] = useState(false)
  const pick = async (e) => {
    const files = [...(e.target.files || [])]
    e.target.value = ''
    try {
      const out = []
      for (const f of files) out.push(await shrink(f))
      setPics((p) => [...p, ...out])
    } catch (err) { alert(err.message) }
  }
  const addPics = async (files) => {
    try { const out = []; for (const x of files) out.push(await shrink(x)); setPics((p) => [...p, ...out]) } catch (err) { alert(err.message) }
  }
  const [over, dropProps] = useDrop(addPics)
  const save = async () => {
    if (!text.trim() && pics.length === 0) return
    setBusy(true)
    const now = Date.now()
    const rid = await addItem('requests', { projectId: part.projectId, partId: part.id, text: text.trim(), status: '요청', updatedAt: now })
    for (const data of pics) await addItem('photos', { projectId: part.projectId, partId: part.id, requestId: rid, data })
    await touch(part.id)
    setBusy(false)
    onDone()
  }
  return (
    <div className={"req-new" + (over ? " drop-over" : "")} {...dropProps} onPaste={(e) => { const f = pastedImages(e); if (f.length) { e.preventDefault(); addPics(f) } }}>
      <textarea autoFocus rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="수정요청 내용 (스크린샷은 끌어다 놓거나 Ctrl+V)" />
      {pics.length > 0 && (
        <div className="thumbs">
          {pics.map((p, i) => (
            <span key={i} className="thumb-edit">
              <img src={p} alt="" />
              <button onClick={() => setPics(pics.filter((_, j) => j !== i))} aria-label="사진 빼기">✕</button>
            </span>
          ))}
        </div>
      )}
      <div className="bactions">
        <label className="pick">🖼 스크린샷·사진<input type="file" accept="image/*" multiple onChange={pick} hidden /></label>
        <span className="grow" />
        <button onClick={onDone}>취소</button>
        <button className="primary" onClick={save} disabled={busy || (!text.trim() && pics.length === 0)}>{busy ? '저장 중…' : '저장'}</button>
      </div>
    </div>
  )
}

function PartCard({ part, requests, photos, onView, sel, onSelect }) {
  const [val, setVal] = useState(part.progress || 0)
  const [edit, setEdit] = useState(null) // 'note' | 'folder' | 'latest'
  const [folderMsg, setFolderMsg] = useState('')
  const [draft, setDraft] = useState('')
  const [adding, setAdding] = useState(false)
  const [open, setOpen] = useState(false)
  const timer = useRef(null)
  useEffect(() => setVal(part.progress || 0), [part.progress])

  const change = (v) => {
    setVal(v)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => updateItem('parts', part.id, { progress: v, updatedAt: Date.now() }), 400)
  }
  const startEdit = (k) => { setDraft(part[k] || ''); setEdit(k) }
  const saveEdit = () => {
    const v = draft.trim()
    updateItem('parts', part.id, { [edit]: v, updatedAt: Date.now(), ...(edit === 'latest' && v !== (part.latest || '') ? { latestAt: Date.now() } : {}) })
    setEdit(null)
  }
  const status = part.status || '시작 전'
  const last = Math.max(part.updatedAt || 0, ...requests.map((r) => r.updatedAt || r.createdAt || 0))
  const doneReq = requests.filter((r) => r.status === '완료').length
  const shown = open ? requests : requests.filter((r) => r.status !== '완료')

  const openFolder = async () => {
    if (hasOpener()) {
      window.location.href = 'upmu-folder:' + escape(part.folder)
      return
    }
    try { await navigator.clipboard.writeText(part.folder) } catch {}
    setFolderMsg("경로를 복사했습니다. 탐색기 주소창에 붙여넣으세요. (바로 열리게 하려면 맨 위 'PC에서 폴더 바로 열기' 설정)")
    setTimeout(() => setFolderMsg(''), 6000)
  }

  return (
    <section className="card part-card">
      <div className="pc-head">
        <h2>{part.name}</h2>
        <button
          className={'badge ' + statusClass(status)}
          onClick={() => updateItem('parts', part.id, { status: cycle(PART_STATUS, status), updatedAt: Date.now() })}
          title="눌러서 상태 변경"
        >{status}</button>
        <button className="del" onClick={() => { if (confirm(`"${part.name}" 항목을 삭제할까요?`)) removeItem('parts', part.id) }} aria-label="삭제">✕</button>
      </div>

      <div className="pc-meta">
        <span>최근 업데이트 {last ? fmtDate(last) : '-'}</span>
        <strong className={val >= 100 ? 'full' : ''}>{val}%</strong>
      </div>
      <input
        type="range" min="0" max="100" step="5" value={val}
        onChange={(e) => change(Number(e.target.value))}
        style={{ '--p': val + '%' }}
        aria-label={`${part.name} 완성도`}
      />

      {edit ? (
        <div className="note-edit">
          {edit === 'note'
            ? <textarea autoFocus rows={3} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="각주 입력" />
            : <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); saveEdit() } else if (e.key === 'Escape') setEdit(null) }} placeholder={edit === 'latest' ? '예) BBP_HEADLINING_R03.CATPart' : '예) D:\\설계\\BBP\\헤드라이닝'} />}
          <div className="bactions">
            <button onClick={() => setEdit(null)}>취소</button>
            <button className="primary" onClick={saveEdit}>저장</button>
          </div>
        </div>
      ) : (
        <>
          <div className="folder-row">
            {part.folder ? (
              <>
                <button className="footnote folder-link" onClick={openFolder} title="눌러서 폴더 열기">📁 {part.folder}</button>
                <button className="copy" onClick={() => startEdit('folder')}>수정</button>
              </>
            ) : (
              <button className="footnote" onClick={() => startEdit('folder')}><span className="muted">📁 폴더 경로 추가</span></button>
            )}
          </div>
          {folderMsg && <p className="hint folder-msg">{folderMsg}</p>}
          <button className="footnote" onClick={() => startEdit('latest')}>
            {part.latest
              ? <>🗂 최신 데이터 <strong>{part.latest}</strong>{part.latestAt ? <span className="muted"> · {fmtDate(part.latestAt)}</span> : null}</>
              : <span className="muted">🗂 최신 데이터명 추가</span>}
          </button>
          <button className="footnote" onClick={() => startEdit('note')}>
            {part.note ? <>📝 {part.note}</> : <span className="muted">📝 각주 추가</span>}
          </button>
        </>
      )}

      <div className="req-box">
        <div className="card-head">
          <h3>수정요청 <span className="count">{doneReq}/{requests.length} 완료</span></h3>
          {!adding && <button onClick={() => setAdding(true)}>+ 추가</button>}
        </div>
        {adding && <NewRequest part={part} onDone={() => setAdding(false)} />}
        <ul className="reqs">
          {shown.map((r) => (
            <Request key={r.id} r={r} photos={photos.filter((p) => p.requestId === r.id)} onView={onView} selected={sel === r.id} onSelect={onSelect} />
          ))}
        </ul>
        {doneReq > 0 && (
          <button className="link" onClick={() => setOpen(!open)}>{open ? '완료된 요청 숨기기' : `완료된 요청 ${doneReq}개 보기`}</button>
        )}
      </div>
    </section>
  )
}

export default function Data({ project, onClose }) {
  const parts = useCollection('parts').filter((p) => p.projectId === project.id).sort(byCreated)
  const requests = useCollection('requests').filter((r) => r.projectId === project.id).sort((a, b) => b.createdAt - a.createdAt)
  const photos = useCollection('photos').filter((p) => p.projectId === project.id).sort(byCreated)
  const [name, setName] = useState('')
  const [view, setView] = useState(null)
  const [sel, setSel] = useState(null) // 선택된 수정요청 (Ctrl+V 대상)
  const [opener, setOpenerState] = useState(hasOpener())
  const [showSetup, setShowSetup] = useState(false)
  const isPhone = /Android|iPhone|iPad/i.test(navigator.userAgent)
  const selRef = useRef(null)
  selRef.current = sel
  // 페이지 어디서든 Ctrl+V: 클립보드 이미지를 선택된 수정요청에 넣는다
  useEffect(() => {
    const onPaste = (e) => {
      if (e.defaultPrevented) return // 새 수정요청 입력칸이 이미 처리함
      const files = pastedImages(e)
      if (!files.length) return
      e.preventDefault()
      const add = pasteTargets.get(selRef.current)
      if (add) add(files)
      else alert("스크린샷을 넣을 수정요청을 먼저 눌러서 선택하세요")
    }
    document.addEventListener("paste", onPaste)
    return () => document.removeEventListener("paste", onPaste)
  }, [])
  const avg = parts.length ? Math.round(parts.reduce((s, p) => s + (p.progress || 0), 0) / parts.length) : 0
  const counts = PART_STATUS.map((s) => [s, parts.filter((p) => (p.status || '시작 전') === s).length])

  const addPart = (e) => {
    e.preventDefault()
    if (!name.trim()) return
    addItem('parts', { projectId: project.id, name: name.trim(), progress: 0, status: '시작 전', updatedAt: Date.now() })
    setName('')
  }

  return (
    <div className="page">
      <header className="bar">
        <button className="back" onClick={onClose} aria-label="뒤로">‹</button>
        <h1>데이터 <small className="sub">{project.name}</small></h1>
      </header>

      <section className="card">
        <div className="card-head">
          <h2>설계 데이터 완성도</h2>
          <strong>전체 {avg}%</strong>
        </div>
        <div className="meter" aria-hidden="true"><div className="used done-bar" style={{ width: avg + '%' }} /></div>
        <div className="status-sum">
          {counts.map(([s, n]) => <span key={s} className={'badge ' + statusClass(s)}>{s} {n}</span>)}
        </div>
        {!isPhone && (
          <button className="link setup-link" onClick={() => setShowSetup(!showSetup)}>
            🖥 PC에서 폴더 바로 열기 {opener ? '(이 PC 설정됨)' : '설정'}
          </button>
        )}
        {showSetup && (
          <div className="setup-box">
            {opener ? (
              <>
                <p className="hint">이 PC에서는 폴더 경로를 누르면 탐색기로 열립니다.</p>
                <div className="bactions"><button onClick={() => { setOpener(false); setOpenerState(false) }}>설정 해제 (경로 복사로 돌아가기)</button></div>
              </>
            ) : (
              <ol className="setup-steps">
                <li><a href="./upmu-folder-setup.cmd" download>설정 파일 받기 (upmu-folder-setup.cmd)</a></li>
                <li>받은 파일을 더블클릭해서 실행 (관리자 권한 필요 없음, 이 PC 사용자에게만 적용)</li>
                <li>
                  아래 버튼을 누르기 → 폴더를 처음 열 때 크롬이 "열기"를 물으면 <b>항상 허용</b> 체크 후 열기
                  <div className="bactions"><button className="primary" onClick={() => { setOpener(true); setOpenerState(true); setShowSetup(false) }}>설정 완료</button></div>
                </li>
              </ol>
            )}
          </div>
        )}
      </section>

      {parts.map((p) => (
        <PartCard
          key={p.id}
          part={p}
          requests={requests.filter((r) => r.partId === p.id)}
          photos={photos.filter((x) => x.partId === p.id)}
          onView={setView}
          sel={sel}
          onSelect={setSel}
        />
      ))}
      {parts.length === 0 && <p className="hint center">설계 데이터 항목이 없습니다</p>}

      <form className="create card" onSubmit={addPart}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="부품 추가" />
        <button type="submit">추가</button>
      </form>

      {view && (
        <div className="viewer" onClick={() => setView(null)}>
          <img src={view} alt="" />
        </div>
      )}
    </div>
  )
}
