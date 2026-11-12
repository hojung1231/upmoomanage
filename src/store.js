// 데이터 저장소: Firebase 설정(.env)이 있으면 Firestore로 PC·핸드폰 실시간 연동,
// 없으면 이 기기 브라우저(localStorage)에만 저장.
import { useEffect, useState } from 'react'

const cfg = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}
export const syncEnabled = Boolean(cfg.apiKey && cfg.projectId)

let fs = null
async function firestore() {
  if (fs) return fs
  const { initializeApp } = await import('firebase/app')
  const m = await import('firebase/firestore')
  fs = { m, db: m.getFirestore(initializeApp(cfg)) }
  return fs
}

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8)

// ---- local fallback ----
const listeners = {}
function readLocal(name) {
  try { return JSON.parse(localStorage.getItem('upmoo:' + name)) || [] } catch { return [] }
}
function writeLocal(name, items) {
  try { localStorage.setItem('upmoo:' + name, JSON.stringify(items)) } catch {}
  ;(listeners[name] || []).forEach((fn) => fn(items))
}

// 컬렉션 구독 훅
export function useCollection(name) {
  const [items, setItems] = useState(() => (syncEnabled ? [] : readLocal(name)))
  useEffect(() => {
    if (!syncEnabled) {
      const fn = (v) => setItems(v)
      ;(listeners[name] ||= []).push(fn)
      return () => { listeners[name] = listeners[name].filter((f) => f !== fn) }
    }
    let unsub = () => {}
    let alive = true
    firestore().then(({ m, db }) => {
      if (!alive) return
      unsub = m.onSnapshot(m.collection(db, name), (snap) =>
        setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      )
    })
    return () => { alive = false; unsub() }
  }, [name])
  return items
}

export async function addItem(name, data) {
  const item = { ...data, createdAt: Date.now() }
  if (!syncEnabled) {
    const id = newId()
    writeLocal(name, [...readLocal(name), { id, ...item }])
    return id
  }
  const { m, db } = await firestore()
  return (await m.addDoc(m.collection(db, name), item)).id
}

export async function removeItem(name, id) {
  if (!syncEnabled) {
    writeLocal(name, readLocal(name).filter((i) => i.id !== id))
    return
  }
  const { m, db } = await firestore()
  await m.deleteDoc(m.doc(db, name, id))
}

export async function updateItem(name, id, data) {
  if (!syncEnabled) {
    writeLocal(name, readLocal(name).map((i) => (i.id === id ? { ...i, ...data } : i)))
    return
  }
  const { m, db } = await firestore()
  await m.updateDoc(m.doc(db, name, id), data)
}

// 처음 실행 시 기본 등록 데이터 (고정 id라 중복 생성되지 않음)
const SEED_PROJECTS = [
  {
    id: 'bbp-phase3',
    name: 'BBP Phase3 대응 자동화 조립 컨셉 통합 트림 개발_개발계획서',
    budget: { advance: 84000000, interim: 84000000, balance: 112000000 },
    createdAt: 1,
  },
]

const SEED_EVENTS = [
  { id: 'bbp-design-done', date: '2026-11-30', title: '정합성 있는 데이터 설계 완료', projectId: 'bbp-phase3', createdAt: 1 },
  { id: 'bbp-design-start', date: '2026-11-18', title: '설계 시작 (내장트림 데이터 수정)', projectId: 'bbp-phase3', createdAt: 3 },
  { id: 'bbp-design-fix', date: '2026-12-01', endDate: '2026-12-31', title: '설계 수정', projectId: 'bbp-phase3', createdAt: 2 },
]

const SEED_EXPENSES = [
  { id: 'bbp-spent-design', projectId: 'bbp-phase3', type: 'spent', date: '2026-09-01', title: '설계비', amount: 7900000, createdAt: 1 },
  { id: 'bbp-plan-design-service', projectId: 'bbp-phase3', type: 'planned', date: '', title: '설계용역비 (2개월분)', amount: 16000000, createdAt: 2 },
  { id: 'bbp-plan-vacuum-mold', projectId: 'bbp-phase3', type: 'planned', date: '', title: '진공주형제작비', amount: 250000000, createdAt: 3 },
]

const SEED_TODOS = [
  { id: 'bbp-todo-vendor', projectId: 'bbp-phase3', title: '설계업체 구하기', done: false, createdAt: 1 },
]

// 설계업무: 내장트림 데이터 수정 (완성도 %)
const SEED_PARTS = [
  { id: 'bbp-part-1', projectId: 'bbp-phase3', name: 'A필러', progress: 0, note: '작년 데이터에서 변경 없는 상태. 프론트 인테리어 모듈 데이터 나오면 매칭부 수정 필요', createdAt: 1 },
  { id: 'bbp-part-2', projectId: 'bbp-phase3', name: 'B필러', progress: 0, note: '시트벨트 모듈과 아세이 데이터 제작 완료. 브라켓 제작 정합성 검토 및 데이터 수정 필요', createdAt: 2 },
  { id: 'bbp-part-3', projectId: 'bbp-phase3', name: '콘솔브라켓 센터', progress: 0, note: '5개씩 제작인지 확인 필요', createdAt: 3 },
  { id: 'bbp-part-4', projectId: 'bbp-phase3', name: '콘솔브라켓 리어', progress: 0, note: '5개씩 제작인지 확인 필요', createdAt: 4 },
  { id: 'bbp-part-5', projectId: 'bbp-phase3', name: '프론트도어 스커프', progress: 0, note: '작년 제작에서 변경된 부분 없음. 카페트 변경 시 매칭 변경 필요', createdAt: 5 },
  { id: 'bbp-part-6', projectId: 'bbp-phase3', name: '리어도어 스커프', progress: 0, note: '작년 제작에서 변경된 부분 없음. 카페트 변경 시 매칭 변경 필요', createdAt: 6 },
  { id: 'bbp-part-7', projectId: 'bbp-phase3', name: '헤드라이닝', progress: 50, note: '50% 정도 설계 진행됨. 회의 후 구체화 필요', createdAt: 7 },
  { id: 'bbp-part-8', projectId: 'bbp-phase3', name: '러기지 사이드트림', progress: 0, note: '', createdAt: 8 },
  { id: 'bbp-part-9', projectId: 'bbp-phase3', name: '리어덕트 아세이', progress: 95, note: '일단 설계 완료. 고객사 요청 있을 시 추가 수정', createdAt: 9 },
]

// 이미 등록된 기본 항목에 새 필드(예: 각주)가 없으면 기본값 채우기 (사용자가 수정한 건 건드리지 않음)
async function seedFill(name, list, field, keys) {
  // 이미 값이 있는 필드(예: 이미 움직인 완성도)는 유지
  const pick = (seedItem, cur = {}) =>
    Object.fromEntries(keys.filter((k) => k === field || !cur[k]).map((k) => [k, seedItem[k]]))
  if (!syncEnabled) {
    const items = readLocal(name)
    let changed = false
    const next = items.map((i) => {
      const s = list.find((x) => x.id === i.id)
      if (!s || i[field] !== undefined) return i
      changed = true
      return { ...i, ...pick(s, i) }
    })
    if (changed) writeLocal(name, next)
    return
  }
  const { m, db } = await firestore()
  for (const s of list) {
    const ref = m.doc(db, name, s.id)
    const snap = await m.getDoc(ref)
    if (snap.exists() && snap.data()[field] === undefined) await m.updateDoc(ref, pick(s, snap.data()))
  }
}

async function seed(name, list) {
  if (!syncEnabled) {
    const items = readLocal(name)
    const missing = list.filter((s) => !items.some((i) => i.id === s.id))
    if (missing.length) writeLocal(name, [...items, ...missing])
    return
  }
  const { m, db } = await firestore()
  for (const { id, ...data } of list) {
    const ref = m.doc(db, name, id)
    if (!(await m.getDoc(ref)).exists()) await m.setDoc(ref, data)
  }
}

export async function ensureSeed() {
  await seed('projects', SEED_PROJECTS)
  await seed('events', SEED_EVENTS)
  await seed('expenses', SEED_EXPENSES)
  await seed('todos', SEED_TODOS)
  await seed('parts', SEED_PARTS)
  await seedFill('parts', SEED_PARTS, 'note', ['note', 'progress'])
}
