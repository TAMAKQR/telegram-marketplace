import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useUserStore } from '../store/userStore'
import { useTelegram } from '../hooks/useTelegram'
import { instagramService } from '../lib/instagramService'
import Logo from '../components/Logo'

function InfluencerProfile() {
    const navigate = useNavigate()
    const { showAlert } = useTelegram()
    const { profile } = useUserStore()
    const [loading, setLoading] = useState(false)
    const [influencerProfile, setInfluencerProfile] = useState(null)
    const [instagramStats, setInstagramStats] = useState(null)
    const [loadingStats, setLoadingStats] = useState(false)

    useEffect(() => {
        if (profile?.id) {
            loadProfile()
        }
    }, [profile])

    const loadProfile = async () => {
        try {
            const { data, error } = await supabase
                .from('influencer_profiles')
                .select('*')
                .eq('user_id', profile.id)
                .single()

            if (data) {
                setInfluencerProfile(data)

                // Загружаем статистику Instagram если подключен
                if (data.instagram_connected && data.instagram_access_token) {
                    loadInstagramStats(data)
                }
            }
        } catch (error) {
            console.log('Профиль еще не создан')
        }
    }

    const loadInstagramStats = async (profileData) => {
        try {
            setLoadingStats(true)

            // Получаем Instagram Business Account ID
            let instagramUserId = profileData.instagram_user_id

            if (!instagramUserId) {
                // Пытаемся получить через Facebook Pages
                const accountsResponse = await fetch(
                    `https://graph.facebook.com/v18.0/me/accounts?fields=instagram_business_account&access_token=${profileData.instagram_access_token}`
                )
                const accountsData = await accountsResponse.json()
                console.log('Facebook Pages response:', accountsData)
                console.log('Facebook Pages data array:', accountsData.data)

                if (accountsData.data && accountsData.data.length > 0) {
                    for (const page of accountsData.data) {
                        console.log('Page:', page)
                        if (page.instagram_business_account) {
                            instagramUserId = page.instagram_business_account.id
                            console.log('Found Instagram Business Account ID:', instagramUserId)
                            break
                        }
                    }
                }

                // Если не нашли, используем прямой запрос
                if (!instagramUserId) {
                    const meResponse = await fetch(
                        `https://graph.facebook.com/v18.0/me?fields=id&access_token=${profileData.instagram_access_token}`
                    )
                    const meData = await meResponse.json()
                    instagramUserId = meData.id
                    console.log('Using Facebook User ID as fallback:', instagramUserId)
                }

                // Сохраняем найденный ID
                if (instagramUserId) {
                    await supabase
                        .from('influencer_profiles')
                        .update({ instagram_user_id: instagramUserId })
                        .eq('id', profileData.id)
                }
            }

            console.log('Attempting to fetch Instagram profile with ID:', instagramUserId)

            // Получаем данные профиля и последние посты
            const userData = await instagramService.getUserProfile(profileData.instagram_access_token, instagramUserId)
            const media = await instagramService.getUserMedia(
                profileData.instagram_access_token,
                userData.id,
                25
            )

            console.log('Instagram media received:', media)
            console.log('Total posts from API:', media.data?.length)
            console.log('First post sample:', media.data?.[0])

            // Рассчитываем общую статистику
            const totalLikes = media.data.reduce((sum, post) => sum + (post.like_count || 0), 0)
            const totalComments = media.data.reduce((sum, post) => sum + (post.comments_count || 0), 0)
            const totalPosts = userData.media_count || media.data.length
            const avgLikes = media.data.length > 0 ? (totalLikes / media.data.length).toFixed(0) : 0
            const avgComments = media.data.length > 0 ? (totalComments / media.data.length).toFixed(0) : 0
            const avgEngagement = media.data.length > 0
                ? ((totalLikes + totalComments) / media.data.length).toFixed(0)
                : 0

            // Engagement rate = ((avg likes + avg comments) / followers) * 100
            const engagementRate = userData.followers_count > 0
                ? (((parseFloat(avgLikes) + parseFloat(avgComments)) / userData.followers_count) * 100).toFixed(2)
                : 0

            // Автоматически обновляем все данные Instagram в базе
            const updateData = {
                instagram_username: userData.username,
                instagram_url: `https://instagram.com/${userData.username}`,
                followers_count: userData.followers_count || 0,
                engagement_rate: parseFloat(engagementRate),
                description: userData.biography || null,
                last_stats_update: new Date().toISOString()
            }

            await supabase
                .from('influencer_profiles')
                .update(updateData)
                .eq('id', profileData.id)

            // Обновляем локальное состояние
            setInfluencerProfile(prev => ({ ...prev, ...updateData }))

            setInstagramStats({
                posts: media.data,
                totalPosts: totalPosts,
                avgLikes: avgLikes,
                avgComments: avgComments,
                avgEngagement,
                engagementRate: engagementRate,
                followers: userData.followers_count || 0,
                following: userData.follows_count || 0,
                name: userData.name,
                username: userData.username,
                biography: userData.biography,
                profilePicture: userData.profile_picture_url
            })
        } catch (error) {
            console.error('Ошибка загрузки статистики:', error)
        } finally {
            setLoadingStats(false)
        }
    }

    const handleConnectInstagram = () => {
        if (!profile?.id) {
            alert('Ошибка: профиль не найден')
            return
        }

        // Показываем информацию пользователю
        const message = '🔐 Вы будете перенаправлены на страницу авторизации Facebook/Instagram.\n\n' +
            '✅ Это безопасно - вы авторизуетесь напрямую на сайте Facebook\n' +
            '✅ После авторизации вы автоматически вернетесь в приложение\n\n' +
            'Продолжить?'

        if (!window.confirm(message)) {
            return
        }

        // Передаем ID пользователя через state parameter
        const authUrl = instagramService.getAuthUrl(profile.id)

        // Используем Telegram WebApp API для открытия внешних ссылок
        if (window.Telegram?.WebApp) {
            // Открываем в браузере через Telegram API
            window.Telegram.WebApp.openLink(authUrl)
        } else {
            // Fallback для тестирования вне Telegram
            window.location.href = authUrl
        }
    }

    const handleDisconnectInstagram = async () => {
        if (!window.confirm('Вы уверены, что хотите отключить Instagram? Автоматическая статистика станет недоступна.')) {
            return
        }

        try {
            setLoading(true)
            const { error } = await supabase
                .from('influencer_profiles')
                .update({
                    instagram_access_token: null,
                    instagram_token_expires_at: null,
                    instagram_user_id: null,
                    instagram_connected: false
                })
                .eq('id', influencerProfile.id)

            if (error) throw error

            await loadProfile()
            setInstagramStats(null)
            showAlert?.('Instagram отключен')
        } catch (error) {
            console.error('Error disconnecting Instagram:', error)
            showAlert?.('Ошибка отключения Instagram')
        } finally {
            setLoading(false)
        }
    }

    const handleRefreshStats = async () => {
        if (influencerProfile?.instagram_connected) {
            await loadInstagramStats(influencerProfile)
            // Перезагружаем профиль чтобы получить обновленные данные
            await loadProfile()
            showAlert?.('Статистика обновлена!')
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()

        if (!influencerProfile?.instagram_connected) {
            showAlert?.('Сначала подключите Instagram')
            return
        }

        // Обновляем статистику
        await handleRefreshStats()
    }

    return (
        <div className="min-h-screen pb-6 overflow-x-hidden">
            {/* Header */}
            <div className="bg-brand-gradient text-white p-4 pt-8">
                <div className="flex items-center gap-3">
                    <Logo className="h-7 w-auto" />
                    <button
                        onClick={() => navigate('/influencer')}
                        className="text-2xl"
                    >
                        ←
                    </button>
                    <h1 className="text-xl font-bold">Мой профиль</h1>
                </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-4 space-y-4 max-w-full">
                <div className="bg-blue-100 dark:bg-blue-900/30 p-4 rounded-xl border border-blue-300 dark:border-blue-700">
                    <p className="text-sm">
                        💡 Заполните информацию о вашем Instagram аккаунте. Это поможет заказчикам принять решение.
                    </p>
                </div>

                {/* Instagram Connection Status */}
                <div className="bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 p-4 rounded-xl border border-purple-300 dark:border-purple-700">
                    {influencerProfile?.instagram_connected ? (
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="text-2xl">✓</div>
                                <div>
                                    <p className="font-semibold text-green-700 dark:text-green-400">
                                        Instagram подключен
                                    </p>
                                    <p className="text-xs text-gray-600 dark:text-gray-400">
                                        @{influencerProfile.instagram_username}
                                    </p>
                                    {influencerProfile.instagram_token_expires_at && (
                                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                                            Токен действителен до {new Date(influencerProfile.instagram_token_expires_at).toLocaleDateString()}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={handleDisconnectInstagram}
                                className="text-xs text-red-600 hover:text-red-700 dark:text-red-400 underline"
                            >
                                Отключить
                            </button>
                        </div>
                    ) : (
                        <div>
                            <div className="flex items-start gap-3 mb-3">
                                <div className="text-2xl">📊</div>
                                <div className="flex-1">
                                    <p className="font-semibold text-purple-800 dark:text-purple-300 mb-1">
                                        Автоматическая статистика
                                    </p>
                                    <p className="text-xs text-gray-600 dark:text-gray-400">
                                        Подключите Instagram для автоматического сбора статистики публикаций (просмотры, охват, вовлеченность)
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={handleConnectInstagram}
                                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white py-3 rounded-xl transition-all flex items-center justify-center gap-2 font-semibold"
                            >
                                <span>📷</span>
                                Подключить Instagram
                            </button>
                        </div>
                    )}
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">
                        Instagram username *
                    </label>
                    <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600">
                        <span className="text-tg-hint">@</span>
                        <span className="flex-1 text-gray-900 dark:text-white">
                            {influencerProfile?.instagram_username || 'Не подключен'}
                        </span>
                        <span className="text-xs text-gray-500">Автоматически из Instagram</span>
                    </div>
                </div>

                {/* Instagram Statistics */}
                {influencerProfile?.instagram_connected && loadingStats && !instagramStats && (
                    <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-xl text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-2"></div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Загрузка данных из Instagram...</p>
                    </div>
                )}

                {influencerProfile?.instagram_connected && instagramStats && (
                    <div className="space-y-4">
                        {/* Основная статистика */}
                        <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-4 rounded-xl border border-purple-200 dark:border-purple-800">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="font-semibold text-purple-900 dark:text-purple-200 flex items-center gap-2">
                                    <span>📊</span>
                                    Статистика эффективности
                                </h3>
                                <a
                                    href={`https://instagram.com/${instagramStats.username}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
                                >
                                    <span>📷</span>
                                    Открыть профиль
                                </a>
                            </div>

                            {/* Ключевые метрики */}
                            <div className="grid grid-cols-2 gap-3 mb-3">
                                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
                                    <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                                        {instagramStats.followers?.toLocaleString() || 0}
                                    </div>
                                    <div className="text-sm text-gray-600 dark:text-gray-400">Подписчиков</div>
                                    <div className="text-xs text-gray-500 mt-1">Охват аудитории</div>
                                </div>
                                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
                                    <div className="text-2xl font-bold text-pink-600 dark:text-pink-400">
                                        {instagramStats.engagementRate}%
                                    </div>
                                    <div className="text-sm text-gray-600 dark:text-gray-400">Вовлеченность</div>
                                    <div className="text-xs text-gray-500 mt-1">Engagement Rate</div>
                                </div>
                            </div>

                            {/* Дополнительные метрики */}
                            <div className="grid grid-cols-4 gap-2">
                                <div className="bg-white dark:bg-gray-800 p-3 rounded-lg text-center">
                                    <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                                        {instagramStats.totalPosts}
                                    </div>
                                    <div className="text-xs text-gray-600 dark:text-gray-400">Постов</div>
                                </div>
                                <div className="bg-white dark:bg-gray-800 p-3 rounded-lg text-center">
                                    <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                                        {instagramStats.avgLikes}
                                    </div>
                                    <div className="text-xs text-gray-600 dark:text-gray-400">Ср. лайков</div>
                                </div>
                                <div className="bg-white dark:bg-gray-800 p-3 rounded-lg text-center">
                                    <div className="text-lg font-bold text-cyan-600 dark:text-cyan-400">
                                        {instagramStats.avgComments}
                                    </div>
                                    <div className="text-xs text-gray-600 dark:text-gray-400">Ср. коммент.</div>
                                </div>
                                <div className="bg-white dark:bg-gray-800 p-3 rounded-lg text-center">
                                    <div className="text-lg font-bold text-green-600 dark:text-green-400">
                                        {instagramStats.avgEngagement}
                                    </div>
                                    <div className="text-xs text-gray-600 dark:text-gray-400">Взаимод.</div>
                                </div>
                            </div>

                            <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                <p className="text-xs text-blue-800 dark:text-blue-300">
                                    💡 <strong>Engagement Rate</strong> показывает процент активных подписчиков.
                                    Чем выше показатель, тем больше отдача от рекламы.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {instagramStats?.biography && (
                    <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl">
                        <label className="block text-sm font-medium mb-2">
                            О себе (из Instagram)
                        </label>
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                            {instagramStats.biography}
                        </p>
                    </div>
                )}

                {influencerProfile?.instagram_connected ? (
                    <button
                        type="button"
                        onClick={handleRefreshStats}
                        disabled={loadingStats}
                        className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white py-4 rounded-xl font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {loadingStats ? (
                            <>
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                Обновление...
                            </>
                        ) : (
                            <>
                                <span>🔄</span>
                                Обновить статистику
                            </>
                        )}
                    </button>
                ) : (
                    <div className="bg-yellow-100 dark:bg-yellow-900/30 p-4 rounded-xl">
                        <p className="text-sm text-yellow-800 dark:text-yellow-200">
                            ⚠️ Подключите Instagram для заполнения профиля. Все данные загрузятся автоматически.
                        </p>
                    </div>
                )}
            </form>
        </div>
    )
}

export default InfluencerProfile
