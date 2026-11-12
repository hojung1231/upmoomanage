import { useEffect, useState } from 'react'

// 앱을 켤 때(또는 다시 화면에 띄울 때) 서버의 version.json을 확인해서
// 새 버전이 있으면 팝업을 띄우고, 버튼을 누르면 바로 새 버전으로 다시 불러온다.
export default function UpdatePopup() {
  const [latest, setLatest] = useState(null)

  useEffect(() => {
    if (import.meta.env.DEV) return
    const check = async () => {
      try {
        const res = await fetch('./version.json?t=' + Date.now(), { cache: 'no-store' })
        const { version } = await res.json()
        if (version && version !== __APP_VERSION__) setLatest(version)
      } catch {}
    }
    check()
    const onVisible = () => document.visibilityState === 'visible' && check()
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  if (!latest) return null

  const update = () => {
    const url = new URL(location.href)
    url.searchParams.set('v', latest)
    location.replace(url.toString())
  }

  return (
    <div className="modal-bg">
      <div className="modal">
        <h2>업데이트가 있습니다</h2>
        <p>새 버전({latest})이 나왔습니다.</p>
        <button className="primary" onClick={update}>지금 업데이트</button>
      </div>
    </div>
  )
}
