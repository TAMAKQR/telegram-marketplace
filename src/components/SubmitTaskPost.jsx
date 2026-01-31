import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { instagramMetricsService } from '../lib/instagramMetricsService'
import { useTelegram } from '../hooks/useTelegram'

export default function SubmitTaskPost({ task, onSuccess }) {
    const { showAlert } = useTelegram()
    const [postUrl, setPostUrl] = useState('')
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e) => {
        e.preventDefault()

        if (!postUrl.trim()) {
            showAlert?.('Введите ссылку на пост')
            return
        }

        // Проверка формата URL
        if (!postUrl.match(/instagram\.com\/(p|reel)\/[A-Za-z0-9_-]+/)) {
            showAlert?.('Неверный формат ссылки. Используйте ссылку вида: https://www.instagram.com/p/ABC123/')
            return
        }

        try {
            setLoading(true)

            // Получаем профиль инфлюенсера
            const { data: profile } = await supabase
                .from('influencer_profiles')
                .select('id, instagram_access_token, instagram_user_id')
                .eq('user_id', task.accepted_influencer_id)
                .single()

            if (!profile?.instagram_access_token) {
                showAlert?.('Сначала подключите Instagram в профиле')
                return
            }

            // Получаем метрики поста
            let metrics
            try {
                metrics = await instagramMetricsService.getPostMetrics(
                    profile.instagram_access_token,
                    postUrl,
                    profile.instagram_user_id
                )
            } catch (error) {
                console.error('Ошибка получения метрик:', error)
                // Если не удалось получить метрики, создаем запись без них
                metrics = {
                    media_id: null,
                    post_type: 'POST',
                    likes_count: 0,
                    comments_count: 0,
                    impressions: 0,
                    reach: 0,
                    engagement: 0
                }
            }

            // Сохраняем пост в базу
            const { error: submitError } = await supabase
                .from('task_posts')
                .insert({
                    task_id: task.id,
                    influencer_id: task.accepted_influencer_id,
                    post_url: postUrl,
                    instagram_media_id: metrics.media_id,
                    post_type: metrics.post_type,
                    impressions: metrics.impressions,
                    reach: metrics.reach,
                    engagement: metrics.engagement,
                    likes_count: metrics.likes_count,
                    comments_count: metrics.comments_count,
                    saves_count: metrics.saves_count || 0,
                    shares_count: metrics.shares_count || 0,
                    base_payment: task.budget,
                    status: 'pending'
                })

            if (submitError) throw submitError

            showAlert?.('Пост успешно отправлен на проверку!')
            setPostUrl('')
            onSuccess?.()

        } catch (error) {
            console.error('Ошибка отправки поста:', error)
            showAlert?.('Ошибка: ' + error.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                <span>📤</span>
                Отправить выполненное задание
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium mb-2">
                        Ссылка на опубликованный пост
                    </label>
                    <input
                        type="url"
                        value={postUrl}
                        onChange={(e) => setPostUrl(e.target.value)}
                        placeholder="https://www.instagram.com/p/ABC123/"
                        className="w-full px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        disabled={loading}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                        Вставьте ссылку на ваш пост в Instagram (Поделиться → Копировать ссылку)
                    </p>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                    <p className="text-sm text-blue-800 dark:text-blue-300">
                        💡 После отправки система автоматически получит метрики вашего поста
                        (просмотры, охват, вовлеченность) и рассчитает вознаграждение
                    </p>
                </div>

                <button
                    type="submit"
                    disabled={loading || !postUrl.trim()}
                    className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white py-3 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
                >
                    {loading ? (
                        <>
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                            <span>Отправка...</span>
                        </>
                    ) : (
                        <>
                            <span>📤</span>
                            <span>Отправить на проверку</span>
                        </>
                    )}
                </button>
            </form>
        </div>
    )
}
