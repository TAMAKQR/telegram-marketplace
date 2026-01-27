import { useEffect, useRef, useState } from 'react'

export const useTelegram = () => {
    const [tg, setTg] = useState(null)
    const [user, setUser] = useState(null)
    const initializedRef = useRef(false)

    useEffect(() => {
        let tries = 0
        let intervalId
        let timeoutId

        const setFavicon = (href) => {
            let link = document.querySelector('link[rel="icon"][type="image/svg+xml"]') || document.querySelector('link[rel="icon"]')
            if (!link) {
                link = document.createElement('link')
                link.rel = 'icon'
                link.type = 'image/svg+xml'
                document.head.appendChild(link)
            }
            link.href = href
        }

        const initTelegram = (telegram) => {
            if (!telegram || initializedRef.current) return
            initializedRef.current = true

            try {
                telegram.ready()
                telegram.expand()
            } catch (e) {
                console.warn('Telegram WebApp ready/expand failed:', e)
            }

            setTg(telegram)

            // initDataUnsafe.user иногда появляется не сразу, поэтому выставляем при наличии
            const unsafeUser = telegram.initDataUnsafe?.user
            if (unsafeUser) setUser(unsafeUser)

            // Apply Telegram theme
            if (telegram.themeParams) {
                document.documentElement.style.setProperty('--tg-theme-bg-color', telegram.themeParams.bg_color || '#ffffff')
                document.documentElement.style.setProperty('--tg-theme-text-color', telegram.themeParams.text_color || '#000000')
                document.documentElement.style.setProperty('--tg-theme-hint-color', telegram.themeParams.hint_color || '#999999')
                document.documentElement.style.setProperty('--tg-theme-link-color', telegram.themeParams.link_color || '#2481cc')
                document.documentElement.style.setProperty('--tg-theme-button-color', telegram.themeParams.button_color || '#2481cc')
                document.documentElement.style.setProperty('--tg-theme-button-text-color', telegram.themeParams.button_text_color || '#ffffff')
            }

            // Set favicon based on theme
            const isDark = telegram.colorScheme === 'dark'
            setFavicon(isDark ? '/logos/logo6.svg' : '/logos/logo4.svg')

            // Update on theme change
            const onThemeChanged = () => {
                const dark = telegram.colorScheme === 'dark'
                setFavicon(dark ? '/logos/logo6.svg' : '/logos/logo4.svg')
            }
            telegram.onEvent?.('themeChanged', onThemeChanged)
        }

        // Telegram WebApp объект может появиться после первого рендера, поэтому пробуем несколько раз
        intervalId = setInterval(() => {
            const telegram = window.Telegram?.WebApp
            if (telegram) {
                clearInterval(intervalId)
                intervalId = null
                initTelegram(telegram)
                return
            }

            tries += 1
            if (tries >= 50) {
                clearInterval(intervalId)
                intervalId = null
                console.warn('Telegram WebApp not detected after retries')
            }
        }, 100)

        // запасной таймаут на случай, если initDataUnsafe.user появится позже, чем сам WebApp
        timeoutId = setTimeout(() => {
            const telegram = window.Telegram?.WebApp
            const unsafeUser = telegram?.initDataUnsafe?.user
            if (unsafeUser) setUser(unsafeUser)
        }, 1500)

        return () => {
            if (intervalId) clearInterval(intervalId)
            if (timeoutId) clearTimeout(timeoutId)
        }
    }, [])

    return {
        tg,
        user,
        showAlert: (message) => tg?.showAlert(message),
        showConfirm: (message) => {
            return new Promise((resolve) => {
                if (!tg) {
                    resolve(false)
                    return
                }

                tg.showPopup({
                    message: message,
                    buttons: [
                        { id: 'cancel', type: 'cancel' },
                        { id: 'ok', type: 'default', text: 'OK' }
                    ]
                }, (buttonId) => {
                    resolve(buttonId === 'ok')
                })
            })
        },
        close: () => tg?.close(),
    }
}
