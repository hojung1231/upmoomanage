import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 빌드할 때마다 새 버전 번호(날짜-시간)를 만들고 dist/version.json에도 기록한다.
const d = new Date(Date.now() + 9 * 3600 * 1000) // KST
const version = d.toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '.')

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'version-json',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version }) })
      },
    },
  ],
  define: { __APP_VERSION__: JSON.stringify(version) },
  base: './',
})
