import { useState, useEffect } from 'react'
import { instagramService } from '../lib/instagramService'

export default function InstagramStats({ influencerProfile, compact = false }) {
    const [stats, setStats] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    useEffect(() => {
        console.log('InstagramStats useEffect:', { influencerProfile, compact })
        if (influencerProfile?.instagram_connected && influencerProfile?.instagram_access_token) {
            loadStats()
        }
    }, [influencerProfile])

    const loadStats = async () => {
        if (!influencerProfile) {
            console.error('loadStats called but no influencerProfile')
            return
        }

        try {
            setLoading(true)
            setError(null)

            // Используем сохраненный instagram_user_id если есть
            const instagramUserId = influencerProfile.instagram_user_id

            if (!instagramUserId) {
                throw new Error('Instagram User ID не найден')
            }

            // Получаем профиль пользователя
            const userData = await instagramService.getUserProfile(
                influencerProfile.instagram_access_token,
                instagramUserId
            )

            // Получаем последние посты
            const media = await instagramService.getUserMedia(
                influencerProfile.instagram_access_token,
                instagramUserId,
                compact ? 6 : 12
            )

            // Проверяем что media.data существует
            if (!media || !media.data || !Array.isArray(media.data)) {
                console.error('Invalid media response:', media)
                throw new Error('Некорректный ответ от Instagram API')
            }

            // Рассчитываем статистику
            const totalLikes = media.data.reduce((sum, post) => sum + (post.like_count || 0), 0)
            const totalComments = media.data.reduce((sum, post) => sum + (post.comments_count || 0), 0)
            const avgEngagement = media.data.length > 0
                ? ((totalLikes + totalComments) / media.data.length).toFixed(0)
                : 0

            setStats({
                posts: media.data,
                totalPosts: media.data.length,
                avgLikes: (totalLikes / media.data.length).toFixed(0),
                avgComments: (totalComments / media.data.length).toFixed(0),
                avgEngagement,
                lastUpdate: new Date()
            })
        } catch (err) {
            console.error('Error loading Instagram stats:', err)
            setError('Не удалось загрузить статистику')
        } finally {
            setLoading(false)
        }
    }

    if (!influencerProfile) {
        console.log('InstagramStats: No influencer profile provided')
        return null
    }

    if (!influencerProfile?.instagram_connected) {
        return (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg">
                <p className="text-xs text-yellow-800 dark:text-yellow-200">
                    📊 Instagram не подключен. Статистика недоступна.
                </p>
            </div>
        )
    }

    if (loading) {
        return (
            <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg text-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600 mx-auto mb-2"></div>
                <p className="text-xs text-gray-600 dark:text-gray-400">Загрузка статистики...</p>
            </div>
        )
    }

    if (error) {
        return (
            <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                <p className="text-xs text-red-800 dark:text-red-200">{error}</p>
                <button
                    onClick={loadStats}
                    className="text-xs text-red-600 dark:text-red-400 underline mt-1"
                >
                    Попробовать снова
                </button>
            </div>
        )
    }

    if (!stats) {
        return null
    }

    if (compact) {
        return (
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-3 rounded-lg border border-purple-200 dark:border-purple-800">
                <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold text-purple-900 dark:text-purple-200">
                        📊 Статистика Instagram
                    </h4>
                    {influencerProfile.instagram_username && (
                        <a
                            href={`https://instagram.com/${influencerProfile.instagram_username}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-purple-600 dark:text-purple-400 hover:underline"
                        >
                            @{influencerProfile.instagram_username}
                        </a>
                    )}
                </div>

                <div className="grid grid-cols-3 gap-2">
                    <div className="bg-white dark:bg-gray-800 p-2 rounded text-center">
                        <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
                            {stats.avgLikes}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">Ср. лайков</div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-2 rounded text-center">
                        <div className="text-lg font-bold text-pink-600 dark:text-pink-400">
                            {stats.avgComments}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">Ср. коммент.</div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-2 rounded text-center">
                        <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                            {stats.avgEngagement}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">Вовлеч-ть</div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-4 rounded-xl border border-purple-200 dark:border-purple-800">
            <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-purple-900 dark:text-purple-200 flex items-center gap-2">
                    <span>📊</span>
                    Статистика Instagram
                </h3>
                {influencerProfile.instagram_username && (
                    <a
                        href={`https://instagram.com/${influencerProfile.instagram_username}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-purple-600 dark:text-purple-400 hover:underline"
                    >
                        @{influencerProfile.instagram_username}
                    </a>
                )}
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-white dark:bg-gray-800 p-3 rounded-lg text-center">
                    <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                        {stats.totalPosts}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">Постов</div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-3 rounded-lg text-center">
                    <div className="text-2xl font-bold text-pink-600 dark:text-pink-400">
                        {stats.avgLikes}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">Ср. лайков</div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-3 rounded-lg text-center">
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {stats.avgComments}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">Ср. коммент.</div>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-3">
                {stats.posts.slice(0, 6).map((post, idx) => (
                    <a
                        key={post.id}
                        href={post.permalink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="relative aspect-square rounded-lg overflow-hidden group"
                    >
                        <img
                            src={post.media_url}
                            alt={`Post ${idx + 1}`}
                            className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs">
                            <div className="text-center">
                                <div>❤️ {post.like_count || 0}</div>
                                <div>💬 {post.comments_count || 0}</div>
                            </div>
                        </div>
                    </a>
                ))}
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                Последние {stats.totalPosts} постов • Обновлено {stats.lastUpdate.toLocaleTimeString()}
            </p>
        </div>
    )
}
