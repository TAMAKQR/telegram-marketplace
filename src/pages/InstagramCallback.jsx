import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { instagramService } from '../lib/instagramService'

export default function InstagramCallback() {
    const [status, setStatus] = useState('processing')
    const [error, setError] = useState(null)
    const navigate = useNavigate()

    useEffect(() => {
        const handleCallback = async () => {
            try {
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

                const userId = state // state содержит UUID пользователя

                setStatus('exchanging_token')

                // Обмениваем код на токен
                const tokenData = await instagramService.exchangeCodeForToken(code)
                const accessToken = tokenData.accessToken // Используем правильное имя свойства

                console.log('Token received:', accessToken)

                setStatus('fetching_instagram_account')

                // Получаем Instagram Business Account ID и Page Access Token через Facebook Pages API
                let instagramUserId = null
                let instagramUsername = null
                let pageAccessToken = accessToken // По умолчанию используем user token

                try {
                    const accountsResponse = await fetch(
                        `https://graph.facebook.com/v18.0/me/accounts?fields=access_token,instagram_business_account{id,username}&access_token=${accessToken}`
                    )
                    const accountsData = await accountsResponse.json()
                    console.log('Facebook Pages with Instagram:', accountsData)

                    if (accountsData.data && accountsData.data.length > 0) {
                        for (const page of accountsData.data) {
                            if (page.instagram_business_account) {
                                instagramUserId = page.instagram_business_account.id
                                instagramUsername = page.instagram_business_account.username
                                pageAccessToken = page.access_token // Используем Page Access Token!
                                console.log('Found Instagram Business Account:', instagramUserId, instagramUsername)
                                console.log('Page Access Token length:', pageAccessToken?.length)
                                console.log('Page Access Token (first 50 chars):', pageAccessToken?.substring(0, 50))
                                break
                            }
                        }
                    }
                } catch (err) {
                    console.error('Error fetching Instagram Business Account:', err)
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
                        instagram_access_token: pageAccessToken, // Используем Page Access Token
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
                        instagram_access_token: pageAccessToken, // Используем Page Access Token
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
                            <p className="text-sm text-gray-500 dark:text-gray-500">
                                Можете закрыть эту вкладку браузера.
                            </p>
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
