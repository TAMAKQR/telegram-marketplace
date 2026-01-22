import { useEffect, useState } from 'react'

export const useTelegram = () => {
    const [tg, setTg] = useState(null)
    const [user, setUser] = useState(null)

    useEffect(() => {
        const telegram = window.Telegram?.WebApp

        if (telegram) {
            telegram.ready()
            telegram.expand()

            setTg(telegram)
            setUser(telegram.initDataUnsafe?.user)

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
            telegram.onEvent?.('themeChanged', () => {
                const dark = telegram.colorScheme === 'dark'
                setFavicon(dark ? '/logos/logo6.svg' : '/logos/logo4.svg')
            })
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
