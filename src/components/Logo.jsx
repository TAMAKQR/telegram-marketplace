import React from 'react'
import { useTelegram } from '../hooks/useTelegram'

function Logo({ className = '', ...props }) {
    const { tg } = useTelegram()
    const isDark = tg?.colorScheme === 'dark'
    const src = isDark ? '/logos/logo6.svg' : '/logos/logo4.svg'

    return (
        <img src={src} alt="Project Logo" className={className} {...props} />
    )
}

export default Logo
