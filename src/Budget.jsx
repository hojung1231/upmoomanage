import { useState } from 'react'
import { useCollection, addItem, removeItem, updateItem } from './store.js'

const ROWS = [
  ['advance', '선금'],
  ['interim', '중도금'],
  ['balance', '잔금'],
]
const won = (n) => (Number(n) || 0).toLocaleString('ko-KR') + '원'
const digits = (v) => String(v ?? '').replace(/[^0-9]/g, '')
const fmt = (v) => (digits(v) ? Number(digits(v)).toLocaleString('ko-KR') : '')
const today = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10)
const sumOf = (items) => items.reduce((s, i) => s + (Number(i.amount) || 0), 0)

// 사용 내역 / 사용 예정 목록 + 추가 폼
function ExpenseList({ title, items, type, projectId }) {
  const [date, setDate] = useState(today())
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')

  const add = (e) => {
    e.preventDefault()
    if (!name.trim() || !digits(amount)) return
    addItem('expenses', { projectId, type, date, title: name.trim(), amount: Number(digits(amount)) })
    setName('')
    setAmount('')
  }

  return (
    <section className="card">
      <div className="card-head">
        <h2>{title}</h2>
        <strong>{won(sumOf(items))}</strong>
      </div>
      <ul className="exp">
        {items.map((i) => (
          <li key={i.id}>
            <span className="d">{(i.date || '').slice(5).replace('-', '/')}</span>
            <span className="t">{i.title}</span>
            <strong>{won(i.amount)}</strong>
            <button className="del" onClick={() => removeItem('expenses', i.id)} aria-label="삭제">✕</button>
          </li>
        ))}
        {items.length === 0 && <li className="empty">등록된 항목 없음</li>}
      </ul>
      <form className="create exp-form two-row" onSubmit={add}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="항목" />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <input inputMode="numeric" value={fmt(amount)} onChange={(e) => setAmount(digits(e.target.value))} placeholder="금액" />
        <button type="submit">추가</button>
      </form>
    </section>
  )
}

export default function Budget({ project, onClose }) {
  const budget = project.budget || {}
  const total = ROWS.reduce((s, [k]) => s + (Number(budget[k]) || 0), 0)
  const expenses = useCollection('expenses')
    .filter((e) => e.projectId === project.id)
    .sort((a, b) => (a.date || '').localeCompare(b.date || '') || a.createdAt - b.createdAt)
  const spentItems = expenses.filter((e) => e.type === 'spent')
  const plannedItems = expenses.filter((e) => e.type === 'planned')
  const spent = sumOf(spentItems)
  const planned = sumOf(plannedItems)
  const remain = total - spent
  const afterPlan = remain - planned

  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const startEdit = () => {
    setForm(Object.fromEntries(ROWS.map(([k]) => [k, digits(budget[k])])))
    setEditing(true)
  }
  const save = (e) => {
    e.preventDefault()
    updateItem('projects', project.id, {
      budget: Object.fromEntries(ROWS.map(([k]) => [k, Number(digits(form[k])) || 0])),
    })
    setEditing(false)
  }

  const pct = total ? Math.min(100, (spent / total) * 100) : 0
  const pctPlan = total ? Math.min(100 - pct, (planned / total) * 100) : 0

  return (
    <div className="page">
      <header className="bar">
        <button className="back" onClick={onClose} aria-label="뒤로">‹</button>
        <h1>사업비 <small className="sub">{project.name}</small></h1>
      </header>

      <section className="summary">
        <div className="remain">
          <span>남은 사업비</span>
          <strong className={remain < 0 ? 'neg' : ''}>{won(remain)}</strong>
        </div>
        <div className="meter" aria-hidden="true">
          <div className="used" style={{ width: pct + '%' }} />
          <div className="plan" style={{ width: pctPlan + '%' }} />
        </div>
        <div className="sgrid">
          <div><span>총 사업비</span><b>{won(total)}</b></div>
          <div><span><i className="sw used" />사용</span><b>{won(spent)}</b></div>
          <div><span><i className="sw plan" />사용 예정</span><b>{won(planned)}</b></div>
          <div><span>예정 반영 후 잔액</span><b className={afterPlan < 0 ? 'neg' : ''}>{won(afterPlan)}</b></div>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>총 사업비</h2>
          {!editing && <button onClick={startEdit}>수정</button>}
        </div>
        {editing ? (
          <form onSubmit={save}>
            {ROWS.map(([k, label]) => (
              <label key={k} className="brow">
                <span>{label}</span>
                <input
                  inputMode="numeric"
                  value={fmt(form[k])}
                  onChange={(e) => setForm({ ...form, [k]: digits(e.target.value) })}
                  placeholder="0"
                />
              </label>
            ))}
            <div className="bactions">
              <button type="button" onClick={() => setEditing(false)}>취소</button>
              <button type="submit" className="primary">저장</button>
            </div>
          </form>
        ) : (
          <>
            {ROWS.map(([k, label]) => (
              <div key={k} className="brow">
                <span>{label}</span>
                <strong>{won(budget[k])}</strong>
              </div>
            ))}
            <div className="brow total">
              <span>합계</span>
              <strong>{won(total)}</strong>
            </div>
          </>
        )}
      </section>

      <ExpenseList title="사용 내역" items={spentItems} type="spent" projectId={project.id} />
      <ExpenseList title="사용 예정" items={plannedItems} type="planned" projectId={project.id} />
    </div>
  )
}
