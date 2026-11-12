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
    writeLocal(name, [...readLocal(name), { id: newId(), ...item }])
    return
  }
  const { m, db } = await firestore()
  await m.addDoc(m.collection(db, name), item)
}

export async function removeItem(name, id) {
  if (!syncEnabled) {
    writeLocal(name, readLocal(name).filter((i) => i.id !== id))
    return
  }
  const { m, db } = await firestore()
  await m.deleteDoc(m.doc(db, name, id))
}
