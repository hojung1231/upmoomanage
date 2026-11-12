// Claude API 키: 이 기기 브라우저에만 저장
const KEY = 'upmoo:claude-key'
export const getApiKey = () => { try { return localStorage.getItem(KEY) || '' } catch { return '' } }
export const setApiKey = (v) => { try { localStorage.setItem(KEY, v.trim()) } catch {} }
