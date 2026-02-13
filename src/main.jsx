import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
)

// Telegram WebApp: signal readiness (optional but recommended)
try {
    window.Telegram?.WebApp?.ready?.()
    window.Telegram?.WebApp?.expand?.()
} catch {
    // ignore
}
