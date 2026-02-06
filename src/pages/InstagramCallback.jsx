import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { instagramService } from '../lib/instagramService'
import { getEnv } from '../lib/runtimeConfig'

export default function InstagramCallback() {
    const [status, setStatus] = useState('processing')
    const [error, setError] = useState(null)
    const navigate = useNavigate()

    const botUsername = getEnv('VITE_TELEGRAM_BOT_USERNAME')
    const webAppShortName = getEnv('VITE_TELEGRAM_WEBAPP_SHORT_NAME')
    const telegramHttpLink = botUsername
        ? (webAppShortName
            ? `https://t.me/${botUsername}/${webAppShortName}?startapp=instagram_connected`
            : `https://t.me/${botUsername}`)
        : null
    const telegramDeepLink = botUsername ? `tg://resolve?domain=${botUsername}` : null

    useEffect(() => {
        if (status !== 'browser_success') return
        if (!telegramHttpLink && !telegramDeepLink) return

        // Some browsers block automatic deep links without user gesture,
        // but it's still worth attempting a gentle redirect.
        const t = setTimeout(() => {
            try {
                if (telegramDeepLink) {
                    window.location.href = telegramDeepLink
                    return
                }
                if (telegramHttpLink) {
                    window.location.href = telegramHttpLink
                }
            } catch {
                // ignore
            }
        }, 1200)

        return () => clearTimeout(t)
    }, [status, telegramDeepLink, telegramHttpLink])

    useEffect(() => {
        const handleCallback = async () => {
            try {
                const parseState = (raw) => {
                    // Backward compatible: raw UUID is accepted.
                    if (!raw) return null

                    // Try base64url JSON: { v: 1, uid, ru }
                    try {
                        const padded = raw.replace(/-/g, '+').replace(/_/g, '/')
                        const padLen = (4 - (padded.length % 4)) % 4
                        const b64 = padded + '='.repeat(padLen)
                        const json = decodeURIComponent(escape(atob(b64)))
                        const parsed = JSON.parse(json)
                        if (parsed && typeof parsed === 'object' && parsed.uid) {
                            return {
                                userId: String(parsed.uid),
                                redirectUri: parsed.ru ? String(parsed.ru) : null,
                            }
                        }
                    } catch {
                        // ignore
                    }

                    return { userId: String(raw), redirectUri: null }
                }

                // Получаем Telegram user ID из URL параметра (передадим его при авторизации)
                const urlParams = new URLSearchParams(window.location.search)
                const code = urlParams.get('code')
                const errorParam = urlParams.get('error')
                const state = urlParams.get('state') // Используем state для передачи user ID

                if (errorParam) {
                    throw new Error(`Instagram authorization error: ${errorParam}`)
                }

                if (!code) {
                    throw new Error('No authorization code received')
                }

                if (!state) {
                    throw new Error('No user ID in state parameter')
                }

                const parsedState = parseState(state)
                if (!parsedState?.userId) {
                    throw new Error('Invalid state parameter')
                }

                const userId = parsedState.userId
                const redirectUriFromState = parsedState.redirectUri

                setStatus('exchanging_token')

                // Обмениваем код на short-lived токен через Instagram API
                const tokenData = await instagramService.exchangeCodeForToken(code, redirectUriFromState || undefined)
                const shortLivedToken = tokenData.accessToken
                const instagramScopedUserId = tokenData.userId // Instagram-scoped user ID из ответа

                console.log('Short-lived token received, user_id:', instagramScopedUserId)

                setStatus('getting_long_token')

                // Получаем long-lived токен (60 дней) через серверную функцию
                let accessToken = shortLivedToken
                try {
                    const longLivedData = await instagramService.getLongLivedToken(shortLivedToken)
                    if (longLivedData?.accessToken) {
                        accessToken = longLivedData.accessToken
                        console.log('Long-lived token received, expires_in:', longLivedData.expiresIn)
                    }
                } catch (err) {
                    console.warn('Could not get long-lived token, using short-lived:', err)
                }

                setStatus('fetching_instagram_account')

                // Получаем Instagram профиль напрямую через Instagram Graph API (без Facebook)
                let instagramUserId = instagramScopedUserId
                let instagramUsername = null

                try {
                    const profileResponse = await fetch(
                        `https://graph.instagram.com/v22.0/me?fields=user_id,username&access_token=${accessToken}`
                    )
                    const profileData = await profileResponse.json()
                    console.log('Instagram profile data:', profileData)

                    if (profileData.data && profileData.data.length > 0) {
                        instagramUserId = profileData.data[0].user_id || instagramUserId
                        instagramUsername = profileData.data[0].username
                    } else if (profileData.user_id) {
                        instagramUserId = profileData.user_id
                        instagramUsername = profileData.username
                    }

                    console.log('Instagram User ID:', instagramUserId, 'Username:', instagramUsername)
                } catch (err) {
                    console.error('Error fetching Instagram profile:', err)
                }

                setStatus('saving_to_database')

                // Вычисляем дату истечения токена (60 дней для долгосрочного)
                const expiresAt = new Date()
                expiresAt.setDate(expiresAt.getDate() + 60)

                // Находим или создаем профиль инфлюенсера
                const { data: existingProfile } = await supabase
                    .from('influencer_profiles')
                    .select('id')
                    .eq('user_id', userId)
                    .single()

                if (existingProfile) {
                    // Обновляем существующий профиль
                    const updateData = {
                        instagram_access_token: accessToken, // Instagram User Access Token
                        instagram_token_expires_at: expiresAt.toISOString(),
                        instagram_connected: true,
                        last_stats_update: new Date().toISOString()
                    }

                    // Добавляем Instagram User ID и Username если нашли
                    if (instagramUserId) {
                        updateData.instagram_user_id = instagramUserId
                    }
                    if (instagramUsername) {
                        updateData.instagram_username = instagramUsername
                    }

                    const { error: updateError } = await supabase
                        .from('influencer_profiles')
                        .update(updateData)
                        .eq('id', existingProfile.id)

                    if (updateError) throw updateError
                } else {
                    // Создаем новый профиль
                    const insertData = {
                        user_id: userId,
                        instagram_access_token: accessToken, // Instagram User Access Token
                        instagram_token_expires_at: expiresAt.toISOString(),
                        instagram_connected: true,
                        last_stats_update: new Date().toISOString()
                    }

                    // Добавляем Instagram User ID и Username если нашли
                    if (instagramUserId) {
                        insertData.instagram_user_id = instagramUserId
                    }
                    if (instagramUsername) {
                        insertData.instagram_username = instagramUsername
                    }

                    const { error: insertError } = await supabase
                        .from('influencer_profiles')
                        .insert(insertData)

                    // Если ошибка 409 (конфликт) - значит профиль уже создан, обновляем его
                    if (insertError) {
                        if (insertError.code === '23505' || insertError.message.includes('duplicate')) {
                            console.log('Duplicate detected, updating existing profile...')
                            const { error: updateError } = await supabase
                                .from('influencer_profiles')
                                .update(insertData)
                                .eq('user_id', userId)

                            if (updateError) throw updateError
                        } else {
                            throw insertError
                        }
                    }
                }

                setStatus('browser_success')

            } catch (err) {
                console.error('Instagram callback error:', err)
                setError(err.message)
                setStatus('error')
            }
        }

        handleCallback()
    }, [navigate])

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-6">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 max-w-md w-full">
                <div className="text-center">
                    {status === 'processing' && (
                        <>
                            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600 mx-auto mb-4"></div>
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                                Подключение Instagram...
                            </h2>
                            <p className="text-gray-600 dark:text-gray-400">
                                Обработка авторизации
                            </p>
                        </>
                    )}

                    {status === 'exchanging_token' && (
                        <>
                            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600 mx-auto mb-4"></div>
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                                Получение токена доступа...
                            </h2>
                        </>
                    )}

                    {status === 'fetching_instagram_account' && (
                        <>
                            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600 mx-auto mb-4"></div>
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                                Получение Instagram Business Account...
                            </h2>
                        </>
                    )}

                    {status === 'getting_long_token' && (
                        <>
                            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600 mx-auto mb-4"></div>
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                                Настройка долгосрочного доступа...
                            </h2>
                        </>
                    )}

                    {status === 'getting_profile' && (
                        <>
                            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600 mx-auto mb-4"></div>
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                                Загрузка профиля Instagram...
                            </h2>
                        </>
                    )}

                    {status === 'saving_to_database' && (
                        <>
                            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600 mx-auto mb-4"></div>
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                                Сохранение данных...
                            </h2>
                        </>
                    )}

                    {status === 'success' && (
                        <>
                            <div className="text-green-500 text-6xl mb-4">✓</div>
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                                Instagram успешно подключен!
                            </h2>
                            <p className="text-gray-600 dark:text-gray-400">
                                Перенаправление в профиль...
                            </p>
                        </>
                    )}

                    {status === 'browser_success' && (
                        <>
                            <div className="text-green-500 text-6xl mb-4">✓</div>
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                                Instagram успешно подключен!
                            </h2>
                            <p className="text-gray-600 dark:text-gray-400 mb-4">
                                Вернитесь в Telegram и обновите профиль, чтобы увидеть изменения.
                            </p>
                            {telegramHttpLink ? (
                                <a
                                    href={telegramHttpLink}
                                    className="inline-flex items-center justify-center bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg transition-colors"
                                >
                                    Вернуться в Telegram
                                </a>
                            ) : (
                                <p className="text-sm text-gray-500 dark:text-gray-500">
                                    Можете закрыть эту вкладку браузера и вернуться в Telegram.
                                </p>
                            )}
                        </>
                    )}

                    {status === 'error' && (
                        <>
                            <div className="text-red-500 text-6xl mb-4">✕</div>
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                                Ошибка подключения
                            </h2>
                            <p className="text-red-600 dark:text-red-400 mb-4">
                                {error}
                            </p>
                            <button
                                onClick={() => navigate('/influencer/profile')}
                                className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg transition-colors"
                            >
                                Вернуться в профиль
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
