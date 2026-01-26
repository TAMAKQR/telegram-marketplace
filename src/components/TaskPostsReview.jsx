import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { instagramMetricsService } from '../lib/instagramMetricsService'
import { useTelegram } from '../hooks/useTelegram'

export default function TaskPostsReview({ taskId }) {
    const { showAlert } = useTelegram()
    const [posts, setPosts] = useState([])
    const [loading, setLoading] = useState(true)
    const [updatingMetrics, setUpdatingMetrics] = useState({})

    useEffect(() => {
        loadPosts()
    }, [taskId])

    const loadPosts = async () => {
        try {
            const { data, error } = await supabase
                .from('task_posts')
                .select(`
                    *,
                    influencer:influencer_id (
                        id,
                        telegram_id,
                        username,
                        first_name
                    ),
                    influencer_profile:influencer_id (
                        instagram_username,
                        instagram_access_token,
                        instagram_user_id
                    )
                `)
                .eq('task_id', taskId)
                .order('submitted_at', { ascending: false })

            if (error) throw error
            setPosts(data || [])
        } catch (error) {
            console.error('Ошибка загрузки постов:', error)
        } finally {
            setLoading(false)
        }
    }

    const updateMetrics = async (post) => {
        try {
            setUpdatingMetrics(prev => ({ ...prev, [post.id]: true }))

            // Получаем свежие метрики
            const metrics = await instagramMetricsService.getMediaMetrics(
                post.influencer_profile.instagram_access_token,
                post.instagram_media_id
            )

            // Обновляем в базе
            const { error } = await supabase
                .from('task_posts')
                .update({
                    impressions: metrics.impressions,
                    reach: metrics.reach,
                    engagement: metrics.engagement,
                    likes_count: metrics.likes_count,
                    comments_count: metrics.comments_count,
                    saves_count: metrics.saves_count,
                    shares_count: metrics.shares_count,
                    last_metrics_update: new Date().toISOString()
                })
                .eq('id', post.id)

            if (error) throw error

            showAlert?.('Метрики обновлены!')
            loadPosts()

        } catch (error) {
            console.error('Ошибка обновления метрик:', error)
            showAlert?.('Ошибка обновления метрик')
        } finally {
            setUpdatingMetrics(prev => ({ ...prev, [post.id]: false }))
        }
    }

    const approvePost = async (postId) => {
        try {
            const { error } = await supabase
                .from('task_posts')
                .update({
                    status: 'approved',
                    approved_at: new Date().toISOString()
                })
                .eq('id', postId)

            if (error) throw error

            showAlert?.('Пост одобрен!')
            loadPosts()

        } catch (error) {
            console.error('Ошибка одобрения:', error)
            showAlert?.('Ошибка одобрения поста')
        }
    }

    const payInfluencer = async (post) => {
        try {
            // Переводим деньги инфлюенсеру
            const { data: { user } } = await supabase.auth.getUser()

            // Проверяем баланс заказчика
            const { data: client } = await supabase
                .from('users')
                .select('balance')
                .eq('id', user.id)
                .single()

            if (client.balance < post.total_payment) {
                showAlert?.('Недостаточно средств на балансе')
                return
            }

            // Выполняем транзакцию
            const { error: transactionError } = await supabase.rpc('transfer_funds', {
                p_from_user_id: user.id,
                p_to_user_id: post.influencer_id,
                p_amount: post.total_payment,
                p_task_id: taskId,
                p_description: `Оплата за выполнение задания`
            })

            if (transactionError) throw transactionError

            // Обновляем статус поста
            const { error: updateError } = await supabase
                .from('task_posts')
                .update({
                    status: 'paid',
                    payment_date: new Date().toISOString()
                })
                .eq('id', post.id)

            if (updateError) throw updateError

            showAlert?.('Оплата выполнена!')
            loadPosts()

        } catch (error) {
            console.error('Ошибка оплаты:', error)
            showAlert?.('Ошибка при выполнении оплаты')
        }
    }

    if (loading) {
        return (
            <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
            </div>
        )
    }

    if (posts.length === 0) {
        return (
            <div className="text-center py-8 text-gray-500">
                Инфлюенсер еще не опубликовал пост
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <h3 className="font-semibold text-lg flex items-center gap-2">
                <span>📊</span>
                Опубликованные посты ({posts.length})
            </h3>

            {posts.map(post => (
                <div key={post.id} className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                    {/* Заголовок */}
                    <div className="flex items-start justify-between mb-3">
                        <div>
                            <div className="font-semibold">
                                @{post.influencer_profile?.instagram_username || post.influencer?.username}
                            </div>
                            <div className="text-sm text-gray-500">
                                {new Date(post.submitted_at).toLocaleString('ru-RU')}
                            </div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${post.status === 'paid' ? 'bg-green-100 text-green-800' :
                                post.status === 'approved' ? 'bg-blue-100 text-blue-800' :
                                    post.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                        'bg-yellow-100 text-yellow-800'
                            }`}>
                            {post.status === 'paid' ? '✓ Оплачено' :
                                post.status === 'approved' ? '✓ Одобрено' :
                                    post.status === 'rejected' ? '✗ Отклонено' :
                                        '⏳ На проверке'}
                        </span>
                    </div>

                    {/* Ссылка на пост */}
                    <a
                        href={post.post_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-purple-600 dark:text-purple-400 hover:underline text-sm flex items-center gap-1 mb-3"
                    >
                        <span>🔗</span>
                        <span>Открыть пост в Instagram</span>
                    </a>

                    {/* Метрики */}
                    <div className="grid grid-cols-4 gap-2 mb-3">
                        <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg text-center">
                            <div className="text-xl font-bold text-purple-600">
                                {post.reach?.toLocaleString() || 0}
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">Охват</div>
                        </div>
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg text-center">
                            <div className="text-xl font-bold text-blue-600">
                                {post.impressions?.toLocaleString() || 0}
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">Показы</div>
                        </div>
                        <div className="bg-pink-50 dark:bg-pink-900/20 p-3 rounded-lg text-center">
                            <div className="text-xl font-bold text-pink-600">
                                {post.likes_count?.toLocaleString() || 0}
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">Лайки</div>
                        </div>
                        <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg text-center">
                            <div className="text-xl font-bold text-green-600">
                                {post.comments_count?.toLocaleString() || 0}
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">Комм.</div>
                        </div>
                    </div>

                    {/* Оплата */}
                    <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg mb-3">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Базовая ставка:</span>
                            <span className="font-semibold">{post.base_payment} ₸</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Бонус за результаты:</span>
                            <span className="font-semibold text-green-600">+{post.bonus_payment || 0} ₸</span>
                        </div>
                        <div className="border-t border-gray-300 dark:border-gray-700 mt-2 pt-2 flex justify-between items-center">
                            <span className="font-semibold">Итого к выплате:</span>
                            <span className="font-bold text-lg text-purple-600">{post.total_payment} ₸</span>
                        </div>
                    </div>

                    {/* Последнее обновление метрик */}
                    {post.last_metrics_update && (
                        <div className="text-xs text-gray-500 mb-3">
                            Метрики обновлены: {new Date(post.last_metrics_update).toLocaleString('ru-RU')}
                        </div>
                    )}

                    {/* Действия */}
                    <div className="flex gap-2">
                        {post.instagram_media_id && post.status !== 'paid' && (
                            <button
                                onClick={() => updateMetrics(post)}
                                disabled={updatingMetrics[post.id]}
                                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-2 rounded-lg text-sm font-medium transition-colors"
                            >
                                {updatingMetrics[post.id] ? 'Обновление...' : '🔄 Обновить метрики'}
                            </button>
                        )}

                        {post.status === 'pending' && (
                            <button
                                onClick={() => approvePost(post.id)}
                                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg text-sm font-medium transition-colors"
                            >
                                ✓ Одобрить
                            </button>
                        )}

                        {post.status === 'approved' && (
                            <button
                                onClick={() => payInfluencer(post)}
                                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg text-sm font-medium transition-colors"
                            >
                                💳 Выплатить {post.total_payment} ₸
                            </button>
                        )}
                    </div>
                </div>
            ))}
        </div>
    )
}
