// Claude Code 전용: 앱에서 '요약 요청'한 회의록을 읽고, 요약 결과를 저장한다.
//   node scripts/notes.mjs pending              → 요청된 회의록 목록(JSON)
//   node scripts/notes.mjs save <noteId> <file> → 요약 결과(JSON 파일)를 회의록에 저장
//   node scripts/notes.mjs audio <dir>          → 받아쓰기 대기(PC 회의 녹음) 음성 파일을 <dir>에 내려받고 목록 출력
//   node scripts/notes.mjs text <noteId> <file> → 받아쓴 글을 회의록 원문으로 넣고 요약 요청 상태로 바꿈
// 인증: 프로젝트 폴더의 firebase-service-account.json (git에 올리지 않음)
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || new URL('../firebase-service-account.json', import.meta.url)
if (!existsSync(keyPath)) {
  console.error('firebase-service-account.json 이 없습니다 (Firebase 콘솔 → 프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성)')
  process.exit(1)
}
initializeApp({ credential: cert(JSON.parse(readFileSync(keyPath, 'utf8'))) })
const db = getFirestore()
db.settings({ preferRest: true }) // 회사망 등에서 gRPC가 막히는 경우 대비

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
} else if (cmd === 'audio' && id) {
  mkdirSync(id, { recursive: true })
  const snap = await db.collection('notes').where('status', '==', 'transcribe').get()
  const out = []
  for (const d of snap.docs) {
    const n = d.data()
    if (!n.audioId) { out.push({ id: d.id, title: n.title, skip: n.error || '음성 파일이 아직 올라가지 않음' }); continue }
    const f = (await db.collection('files').doc(n.audioId).get()).data()
    let b64 = ''
    for (let i = 0; i < f.chunks; i++) b64 += (await db.collection('fileChunks').doc(`${n.audioId}_${i}`).get()).data()?.data || ''
    const path = join(id, d.id + (f.name.match(/\.\w+$/)?.[0] || '.webm'))
    writeFileSync(path, Buffer.from(b64, 'base64'))
    out.push({ id: d.id, title: n.title, file: path, minutes: Math.round((n.sec || 0) / 60) })
  }
  console.log(JSON.stringify(out, null, 2))
} else if (cmd === 'text' && id && file) {
  const text = readFileSync(file, 'utf8').trim()
  await db.collection('notes').doc(id).update({ text: text || '(받아쓴 내용이 없습니다)', status: 'requested', error: '' })
  console.log(`원문 저장 완료: ${id} (${text.split('\n').length}줄) → 요약 요청 상태`)
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
  console.error('사용법: node scripts/notes.mjs pending | save <noteId> <result.json> | audio <dir> | text <noteId> <transcript.txt>')
  process.exit(1)
}
