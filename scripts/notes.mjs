// Claude Code 전용: 앱에서 '요약 요청'한 회의록을 읽고, 요약 결과를 저장한다.
//   node scripts/notes.mjs pending              → 요청된 회의록 목록(JSON)
//   node scripts/notes.mjs save <noteId> <file> → 요약 결과(JSON 파일)를 회의록에 저장
// 인증: 프로젝트 폴더의 firebase-service-account.json (git에 올리지 않음)
import { readFileSync, existsSync } from 'node:fs'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || new URL('../firebase-service-account.json', import.meta.url)
if (!existsSync(keyPath)) {
  console.error('firebase-service-account.json 이 없습니다 (Firebase 콘솔 → 프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성)')
  process.exit(1)
}
initializeApp({ credential: cert(JSON.parse(readFileSync(keyPath, 'utf8'))) })
const db = getFirestore()

const [cmd, id, file] = process.argv.slice(2)
const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10)
const isDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || '')

if (cmd === 'pending') {
  const snap = await db.collection('notes').where('status', '==', 'requested').get()
  const projects = Object.fromEntries((await db.collection('projects').get()).docs.map((d) => [d.id, d.data().name]))
  const out = snap.docs.map((d) => {
    const n = d.data()
    return { id: d.id, project: projects[n.projectId] || n.projectId, title: n.title, createdAt: n.createdAt, text: n.text }
  })
  console.log(JSON.stringify({ today, notes: out }, null, 2))
} else if (cmd === 'save' && id && file) {
  const r = JSON.parse(readFileSync(file, 'utf8'))
  const data = {
    status: 'done',
    error: '',
    ...(r.title ? { title: String(r.title) } : {}),
    summary: String(r.summary || ''),
    checklist: (r.checklist || []).map((t) => ({ text: String(typeof t === 'string' ? t : t.text), done: false })),
    schedules: (r.schedules || [])
      .filter((s) => s && s.title && isDate(s.date))
      .map((s) => ({
        title: String(s.title),
        date: s.date,
        ...(isDate(s.endDate) && s.endDate > s.date ? { endDate: s.endDate } : {}),
        reason: String(s.reason || ''),
        status: 'pending',
      })),
  }
  await db.collection('notes').doc(id).update(data)
  console.log(`저장 완료: ${id} (체크리스트 ${data.checklist.length}개, 스케줄 후보 ${data.schedules.length}개)`)
} else {
  console.error('사용법: node scripts/notes.mjs pending | save <noteId> <result.json>')
  process.exit(1)
}
