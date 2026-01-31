import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

const PRELOADER_MIN_MS = 650
const PRELOADER_MAX_MS = 12000
const preloaderStartedAt = Date.now()

function hideAppPreloader() {
    const preloader = document.getElementById('app-preloader')
    if (!preloader) return

    const elapsed = Date.now() - preloaderStartedAt
    const remaining = Math.max(PRELOADER_MIN_MS - elapsed, 0)

    window.setTimeout(() => {
        preloader.classList.add('fade-out')
        window.setTimeout(() => preloader.remove(), 260)
    }, remaining)
}

// Expose for the app to call when it's actually ready
window.__hideAppPreloader = hideAppPreloader

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
)

// Safety: never keep preloader forever
window.setTimeout(() => {
    hideAppPreloader()
}, PRELOADER_MAX_MS)

// Telegram WebApp: signal readiness (optional but recommended)
try {
    window.Telegram?.WebApp?.ready?.()
    window.Telegram?.WebApp?.expand?.()
} catch {
    // ignore
}
