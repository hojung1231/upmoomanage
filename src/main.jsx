import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './style.css'

if ('serviceWorker' in navigator && !import.meta.env.DEV) {
  navigator.serviceWorker.register('./sw.js').catch(() => {})
}

createRoot(document.getElementById('root')).render(<App />)
