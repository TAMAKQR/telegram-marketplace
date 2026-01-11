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

            // Apply Telegram theme
            if (telegram.themeParams) {
                document.documentElement.style.setProperty('--tg-theme-bg-color', telegram.themeParams.bg_color || '#ffffff')
                document.documentElement.style.setProperty('--tg-theme-text-color', telegram.themeParams.text_color || '#000000')
                document.documentElement.style.setProperty('--tg-theme-hint-color', telegram.themeParams.hint_color || '#999999')
                document.documentElement.style.setProperty('--tg-theme-link-color', telegram.themeParams.link_color || '#2481cc')
                document.documentElement.style.setProperty('--tg-theme-button-color', telegram.themeParams.button_color || '#2481cc')
                document.documentElement.style.setProperty('--tg-theme-button-text-color', telegram.themeParams.button_text_color || '#ffffff')
            }
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
