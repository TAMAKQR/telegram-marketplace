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
    const [isManualMode, setIsManualMode] = useState(false)

    // Ручной ввод данных Instagram
    const [manualData, setManualData] = useState({
        instagram_username: '',
        followers_count: '',
        engagement_rate: ''
    })

    useEffect(() => {
        if (profile?.id) {
            loadProfile()
            loadMetricsMode()
        }
    }, [profile])

    const loadMetricsMode = async () => {
        try {
            const { data, error } = await supabase
                .from('app_settings')
                .select('value')
                .eq('key', 'instagram_metrics_mode')
                .maybeSingle()

            if (!error && data) {
                const mode = typeof data.value === 'string' ? data.value : JSON.parse(data.value)
                setIsManualMode(mode === 'manual')
            }
        } catch (e) {
            console.warn('Could not load metrics mode:', e)
        }
    }

    const loadProfile = async () => {
        try {
            const { data, error } = await supabase
                .from('influencer_profiles')
                .select('id, user_id, instagram_username, instagram_url, followers_count, engagement_rate, category, description, price_per_post, verified, created_at, updated_at, instagram_token_expires_at, instagram_user_id, instagram_connected, last_stats_update')
                .eq('user_id', profile.id)
                .single()

            if (data) {
                setInfluencerProfile(data)

                // Заполняем форму ручного ввода текущими данными
                setManualData({
                    instagram_username: data.instagram_username || '',
                    followers_count: data.followers_count?.toString() || '',
                    engagement_rate: data.engagement_rate?.toString() || ''
                })

                // Загружаем сохраненную статистику (без обращения к Instagram API)
                if (data.instagram_connected) {
                    loadCachedInstagramStats(data)
                }
            }
        } catch (error) {
            console.log('Профиль еще не создан')
        }
    }

    const loadCachedInstagramStats = async (profileData) => {
        try {
            setLoadingStats(true)
            const { data, error } = await supabase
                .from('instagram_stats')
                .select('followers_count, following_count, posts_count, avg_likes, avg_comments, engagement_rate, recorded_at')
                .eq('influencer_profile_id', profileData.id)
                .order('recorded_at', { ascending: false })
                .limit(1)

            if (error) throw error
            const latest = Array.isArray(data) ? data[0] : null
            if (!latest) {
                setInstagramStats(null)
                return
            }

            const avgLikes = Number(latest.avg_likes ?? 0)
            const avgComments = Number(latest.avg_comments ?? 0)
            const engagementRate = Number(profileData.engagement_rate ?? latest.engagement_rate ?? 0)

            setInstagramStats({
                totalPosts: Number(latest.posts_count ?? 0),
                avgLikes: avgLikes.toFixed(0),
                avgComments: avgComments.toFixed(0),
                avgEngagement: (avgLikes + avgComments).toFixed(0),
                engagementRate: engagementRate.toFixed(2),
                followers: Number(profileData.followers_count ?? latest.followers_count ?? 0),
                following: Number(latest.following_count ?? 0),
                username: profileData.instagram_username,
                biography: profileData.description,
                lastUpdate: latest.recorded_at ? new Date(latest.recorded_at) : null
            })
        } catch (error) {
            console.error('Ошибка загрузки статистики:', error)
            setInstagramStats(null)
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
        const message = '🔐 Вы будете перенаправлены на страницу авторизации Instagram.\n\n' +
            '✅ Это безопасно - вы авторизуетесь напрямую на сайте Instagram\n' +
            '✅ После авторизации вы автоматически вернетесь в приложение\n' +
            '✅ Facebook аккаунт не требуется\n\n' +
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
            try {
                setLoadingStats(true)
                const { data, error } = await supabase.rpc('refresh_instagram_stats_for_user', { p_user_id: profile.id })

                if (error) throw error

                if (!data || data.success !== true) {
                    const code = (data && data.error) ? data.error : 'stats_not_saved'
                    const messageByCode = {
                        instagram_not_connected: 'Instagram не подключен',
                        missing_access_token: 'Нет токена Instagram. Переподключите Instagram.',
                        missing_instagram_user_id: 'Не найден Instagram User ID. Переподключите Instagram.',
                        instagram_profile_api_error: 'Instagram API не вернул данные профиля (возможно аккаунт не Business/Creator или нет прав).',
                        instagram_media_api_error: 'Instagram API не вернул медиа (возможно нет прав).',
                        stats_not_saved: 'Статистика не сохранилась в базе. Проверьте, что применена миграция refresh_instagram_stats_for_user.'
                    }
                    showAlert?.(messageByCode[code] || `Не удалось обновить статистику: ${code}`)
                    return
                }
            } catch (e) {
                console.error('refresh_instagram_stats_for_user failed:', e)
                showAlert?.('Не удалось обновить статистику')
            } finally {
                setLoadingStats(false)
            }

            await loadProfile()
            showAlert?.('Статистика обновлена!')
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()

        // В ручном режиме сохраняем введённые данные
        if (isManualMode) {
            if (!manualData.instagram_username) {
                showAlert?.('Введите Instagram username')
                return
            }

            setLoading(true)
            try {
                const updateData = {
                    instagram_username: manualData.instagram_username.replace('@', ''),
                    followers_count: manualData.followers_count ? parseInt(manualData.followers_count) : 0,
                    engagement_rate: manualData.engagement_rate ? parseFloat(manualData.engagement_rate) : 0
                }

                if (influencerProfile?.id) {
                    // Обновляем существующий профиль
                    const { error } = await supabase
                        .from('influencer_profiles')
                        .update(updateData)
                        .eq('id', influencerProfile.id)

                    if (error) throw error
                } else {
                    // Создаём новый профиль
                    const { error } = await supabase
                        .from('influencer_profiles')
                        .insert({ ...updateData, user_id: profile.id })

                    if (error) throw error
                }

                await loadProfile()
                showAlert?.('Данные сохранены!')
            } catch (error) {
                console.error('Ошибка сохранения:', error)
                showAlert?.('Ошибка сохранения: ' + error.message)
            } finally {
                setLoading(false)
            }
            return
        }

        // В авто-режиме требуем подключение Instagram
        if (!influencerProfile?.instagram_connected) {
            showAlert?.('Сначала подключите Instagram')
            return
        }

        // Обновляем статистику только если Instagram подключен
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
                {/* Instagram Connection Status */}
                <div className="bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 p-4 rounded-xl border border-purple-300 dark:border-purple-700">
                    {isManualMode ? (
                        // Ручной режим - форма ввода данных Instagram
                        <div className="space-y-4">
                            <div className="flex items-start gap-3">
                                <div className="text-2xl">✍️</div>
                                <div className="flex-1">
                                    <p className="font-semibold text-purple-700 dark:text-purple-400 mb-1">
                                        Ручной режим
                                    </p>
                                    <p className="text-xs text-gray-600 dark:text-gray-400">
                                        Введите данные вашего Instagram профиля для отображения заказчикам
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Instagram username *
                                    </label>
                                    <div className="flex items-center">
                                        <span className="px-3 py-2 bg-gray-200 dark:bg-gray-700 rounded-l-lg text-gray-600 dark:text-gray-400 border border-r-0 border-gray-300 dark:border-gray-600">@</span>
                                        <input
                                            type="text"
                                            value={manualData.instagram_username}
                                            onChange={(e) => setManualData({ ...manualData, instagram_username: e.target.value.replace('@', '') })}
                                            className="flex-1 p-2 border border-gray-300 dark:border-gray-600 rounded-r-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                            placeholder="username"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            👥 Подписчики
                                        </label>
                                        <input
                                            type="number"
                                            value={manualData.followers_count}
                                            onChange={(e) => setManualData({ ...manualData, followers_count: e.target.value })}
                                            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                            placeholder="10000"
                                            min="0"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            📊 ER (%)
                                        </label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={manualData.engagement_rate}
                                            onChange={(e) => setManualData({ ...manualData, engagement_rate: e.target.value })}
                                            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                            placeholder="3.5"
                                            min="0"
                                            max="100"
                                        />
                                    </div>
                                </div>

                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    💡 Engagement Rate можно посчитать: (лайки + комменты) / подписчики × 100
                                </p>
                            </div>
                        </div>
                    ) : influencerProfile?.instagram_connected ? (
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

                {/* Показываем read-only поле username только в авто-режиме */}
                {!isManualMode && (
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
                )}

                {/* Instagram Statistics */}
                {influencerProfile?.instagram_connected && loadingStats && !instagramStats && (
                    <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-xl text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-2"></div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Загрузка сохраненной статистики...</p>
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

                {isManualMode ? (
                    // Кнопка сохранения для ручного режима
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white py-4 rounded-xl font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                Сохранение...
                            </>
                        ) : (
                            <>
                                <span>💾</span>
                                Сохранить данные
                            </>
                        )}
                    </button>
                ) : influencerProfile?.instagram_connected ? (
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
