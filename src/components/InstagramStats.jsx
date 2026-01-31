import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function InstagramStats({ influencerProfile, compact = false }) {
    const [stats, setStats] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    useEffect(() => {
        if (influencerProfile?.id) {
            loadStats()
        }
    }, [influencerProfile?.id])

    const loadStats = async () => {
        if (!influencerProfile) {
            return
        }

        try {
            setLoading(true)
            setError(null)
            const { data, error: fetchError } = await supabase
                .from('instagram_stats')
                .select('followers_count, following_count, posts_count, avg_likes, avg_comments, engagement_rate, recorded_at')
                .eq('influencer_profile_id', influencerProfile.id)
                .order('recorded_at', { ascending: false })
                .limit(1)

            if (fetchError) throw fetchError

            const latest = Array.isArray(data) ? data[0] : null
            if (!latest) {
                setStats(null)
                return
            }

            setStats({
                followers: latest.followers_count ?? null,
                following: latest.following_count ?? null,
                postsCount: latest.posts_count ?? null,
                avgLikes: latest.avg_likes ?? null,
                avgComments: latest.avg_comments ?? null,
                engagementRate: latest.engagement_rate ?? null,
                recordedAt: latest.recorded_at ? new Date(latest.recorded_at) : null
            })
        } catch (err) {
            setError('Не удалось загрузить статистику')
        } finally {
            setLoading(false)
        }
    }

    if (!influencerProfile) {
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
        return (
            <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                <p className="text-xs text-gray-600 dark:text-gray-400">
                    📊 Нет сохранённой статистики. Попросите инфлюенсера нажать «Обновить статистику» в профиле.
                </p>
            </div>
        )
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
                            {stats.avgLikes !== null ? Number(stats.avgLikes).toFixed(0) : '—'}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">Ср. лайков</div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-2 rounded text-center">
                        <div className="text-lg font-bold text-pink-600 dark:text-pink-400">
                            {stats.avgComments !== null ? Number(stats.avgComments).toFixed(0) : '—'}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">Ср. коммент.</div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-2 rounded text-center">
                        <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                            {stats.engagementRate !== null ? `${Number(stats.engagementRate).toFixed(2)}%` : '—'}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">Engagement Rate</div>
                    </div>
                </div>

                {stats.recordedAt ? (
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-2">
                        Обновлено {stats.recordedAt.toLocaleString('ru-RU')}
                    </p>
                ) : null}
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

            <div className="grid grid-cols-3 gap-3">
                <div className="bg-white dark:bg-gray-800 p-3 rounded-lg text-center">
                    <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                        {stats.avgLikes !== null ? Number(stats.avgLikes).toFixed(0) : '—'}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">Ср. лайков</div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-3 rounded-lg text-center">
                    <div className="text-2xl font-bold text-pink-600 dark:text-pink-400">
                        {stats.avgComments !== null ? Number(stats.avgComments).toFixed(0) : '—'}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">Ср. коммент.</div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-3 rounded-lg text-center">
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {stats.engagementRate !== null ? `${Number(stats.engagementRate).toFixed(2)}%` : '—'}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">Engagement Rate</div>
                </div>
            </div>

            {stats.recordedAt ? (
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-3">
                    Обновлено {stats.recordedAt.toLocaleString('ru-RU')}
                </p>
            ) : null}
        </div>
    )
}
