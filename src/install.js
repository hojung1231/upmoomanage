// 홈 화면 설치(앱 설치) 버튼 지원
import { useEffect, useState } from 'react'

let deferred = null
const subs = new Set()
const notify = () => subs.forEach((fn) => fn(!!deferred))

// React가 뜨기 전에 이벤트가 올 수 있어서 바로 등록
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  deferred = e
  notify()
})
window.addEventListener('appinstalled', () => {
  deferred = null
  notify()
})

export const isInstalled = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true

export function useInstall() {
  const [canInstall, setCanInstall] = useState(!!deferred)
  useEffect(() => {
    subs.add(setCanInstall)
    return () => subs.delete(setCanInstall)
  }, [])
  const install = async () => {
    if (!deferred) return
    deferred.prompt()
    await deferred.userChoice.catch(() => {})
    deferred = null
    notify()
  }
  return { canInstall, install }
}
