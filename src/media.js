// 사진·파일 공용 도우미: 사진 줄이기, 끌어다 놓기, 붙여넣기
import { useState } from 'react'

// 사진을 줄여서 JPEG 데이터로 (한 장 수백 KB 이내)
export function shrink(file, max = 1400) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * k)
      c.height = Math.round(img.height * k)
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url)
      resolve(c.toDataURL('image/jpeg', 0.72))
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('사진을 읽지 못했습니다')) }
    img.src = url
  })
}

const isImage = (f) => f.type.startsWith('image/')

// 드래그앤드롭 받기: 끌어오는 동안 테두리 강조. imagesOnly=false 면 모든 파일
export function useDrop(onFiles, imagesOnly = true) {
  const [over, setOver] = useState(false)
  return [over, {
    onDragOver: (e) => { if ([...(e.dataTransfer?.types || [])].includes('Files')) { e.preventDefault(); setOver(true) } },
    onDragLeave: (e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOver(false) },
    onDrop: (e) => {
      e.preventDefault()
      setOver(false)
      const f = [...(e.dataTransfer?.files || [])].filter((x) => !imagesOnly || isImage(x))
      if (f.length) onFiles(f)
    },
  }]
}

// 붙여넣기(Ctrl+V)한 클립보드에서 이미지 파일만 꺼내기
export const pastedImages = (e) => [...(e.clipboardData?.items || [])]
  .filter((i) => i.type.startsWith('image/')).map((i) => i.getAsFile()).filter(Boolean)

export const fmtSize = (n) => n >= 1048576 ? (n / 1048576).toFixed(1) + 'MB' : Math.max(1, Math.round(n / 1024)) + 'KB'
