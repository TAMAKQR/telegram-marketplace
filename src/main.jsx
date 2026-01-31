import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
)

// Hide the HTML preloader as soon as React is mounted
const preloader = document.getElementById('app-preloader')
if (preloader) {
    // Allow one paint so the UI doesn't flash
    requestAnimationFrame(() => {
        preloader.classList.add('fade-out')
        window.setTimeout(() => preloader.remove(), 260)
    })
}

// Telegram WebApp: signal readiness (optional but recommended)
try {
    window.Telegram?.WebApp?.ready?.()
    window.Telegram?.WebApp?.expand?.()
} catch {
    // ignore
}
