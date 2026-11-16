// 회의 음성을 MP3로 녹음한다.
// - 핸드폰: 마이크(내 목소리)만
// - PC: 마이크 + 화면 공유의 "시스템 오디오"(헤드셋으로 들리는 상대방 목소리)를 합쳐서
import { Mp3Encoder } from '@breezystack/lamejs'

const nav = typeof navigator !== 'undefined' ? navigator : {}
export const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(nav.userAgent || '')
export const canMp3 = !!nav.mediaDevices?.getUserMedia
export const canCaptureSystem = !isMobile && !!nav.mediaDevices?.getDisplayMedia

const KBPS = 64 // 음성용 (1시간 약 28MB)

const level = (an, buf) => {
  if (!an) return 0
  an.getFloatTimeDomainData(buf)
  let peak = 0
  for (let i = 0; i < buf.length; i++) peak = Math.max(peak, Math.abs(buf[i]))
  return Math.min(1, peak * 1.6)
}

// system=true 면 화면 공유 창을 띄워 시스템 오디오도 받는다. (반드시 버튼 클릭 안에서 호출)
export async function startMp3({ system = false, onSystemEnded } = {}) {
  const streams = []
  const stopAll = () => streams.forEach((s) => s.getTracks().forEach((t) => t.stop()))

  let sys = null
  if (system) {
    try {
      sys = await nav.mediaDevices.getDisplayMedia({
        video: true,
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        systemAudio: 'include',
        selfBrowserSurface: 'exclude',
      })
    } catch (e) {
      throw new Error('화면 공유를 취소했습니다. 상대방 목소리를 녹음하려면 공유를 허용해 주세요.')
    }
    streams.push(sys)
    if (!sys.getAudioTracks().length) {
      stopAll()
      throw new Error('시스템 오디오가 공유되지 않았습니다. 공유 창에서 "전체 화면"을 고르고 "시스템 오디오도 공유"를 켜 주세요.')
    }
  }

  let mic
  try {
    mic = await nav.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
  } catch {
    stopAll()
    throw new Error('마이크 권한이 필요합니다. 브라우저 설정에서 마이크를 허용해 주세요.')
  }
  streams.push(mic)

  const ctx = new (window.AudioContext || window.webkitAudioContext)()
  await ctx.resume()
  const mix = ctx.createGain()
  const tap = (stream) => {
    const src = ctx.createMediaStreamSource(stream)
    const an = ctx.createAnalyser()
    an.fftSize = 512
    src.connect(an)
    src.connect(mix)
    return an
  }
  const micAn = tap(mic)
  const sysAn = sys ? tap(sys) : null

  const enc = new Mp3Encoder(1, ctx.sampleRate, KBPS)
  const chunks = []
  let bytes = 0
  let paused = false
  const proc = ctx.createScriptProcessor(4096, 1, 1)
  proc.onaudioprocess = (e) => {
    if (paused) return
    const f = e.inputBuffer.getChannelData(0)
    const pcm = new Int16Array(f.length)
    for (let i = 0; i < f.length; i++) {
      const v = Math.max(-1, Math.min(1, f[i]))
      pcm[i] = v < 0 ? v * 0x8000 : v * 0x7fff
    }
    const out = enc.encodeBuffer(pcm)
    if (out.length) { chunks.push(out); bytes += out.length }
  }
  const mute = ctx.createGain()
  mute.gain.value = 0
  mix.connect(proc)
  proc.connect(mute)
  mute.connect(ctx.destination)

  // 사용자가 브라우저의 "공유 중지"를 누르면 알림
  sys?.getAudioTracks()[0].addEventListener('ended', () => onSystemEnded?.())

  const buf = new Float32Array(512)
  let closed = false
  const close = () => {
    if (closed) return
    closed = true
    proc.onaudioprocess = null
    try { mix.disconnect(); proc.disconnect(); mute.disconnect() } catch {}
    stopAll()
    ctx.close().catch(() => {})
  }

  return {
    hasSystem: !!sys,
    pause: () => { paused = true },
    resume: () => { paused = false },
    levels: () => ({ mic: level(micAn, buf), sys: level(sysAn, buf) }),
    size: () => bytes,
    // 녹음 끝내고 MP3 Blob 돌려주기
    stop: () => {
      close()
      const last = enc.flush()
      if (last.length) chunks.push(last)
      return new Blob(chunks, { type: 'audio/mpeg' })
    },
    discard: close,
  }
}

export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}
