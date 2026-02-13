import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useUserStore } from '../store/userStore'
import { useTelegram } from '../hooks/useTelegram'
import { instagramMetricsService } from '../lib/instagramMetricsService'
import Logo from '../components/Logo'
import { formatTaskBudget } from '../lib/taskBudget'

function SubmitTaskPost() {
    const navigate = useNavigate()
    const { taskId } = useParams()
    const { profile } = useUserStore()
    const { showAlert } = useTelegram()

    const [loading, setLoading] = useState(false)
    const [task, setTask] = useState(null)
    const [application, setApplication] = useState(null)
    const [submission, setSubmission] = useState(null)
    const [postUrl, setPostUrl] = useState('')
    const [isManualMode, setIsManualMode] = useState(false)

    useEffect(() => {
        loadTaskAndApplication()
        loadMetricsMode()
    }, [taskId])

    const loadMetricsMode = async () => {
        try {
            const { data, error } = await supabase
                .from('app_settings')
                .select('value')
                .eq('key', 'instagram_metrics_mode')
                .maybeSingle()

            if (!error && data) {
                let mode = data.value
                if (typeof mode === 'string') {
                    try {
                        mode = JSON.parse(mode)
                    } catch (e) {
                        // уже обычная строка
                    }
                }
                setIsManualMode(mode === 'manual')
            }
        } catch (e) {
            console.warn('Could not load metrics mode:', e)
        }
    }

    const loadTaskAndApplication = async () => {
        try {
            // Загружаем задание
            const { data: taskData, error: taskError } = await supabase
                .from('tasks')
                .select('*')
                .eq('id', taskId)
                .single()

            if (taskError) throw taskError
            setTask(taskData)

            // Загружаем заявку инфлюенсера
            const { data: appData, error: appError } = await supabase
                .from('task_applications')
                .select('*')
                .eq('task_id', taskId)
                .eq('influencer_id', profile.id)
                .eq('status', 'accepted')
                .single()

            if (appError) throw appError
            setApplication(appData)

            // Проверяем есть ли уже сабмишен
            const { data: subData } = await supabase
                .from('task_submissions')
                .select('*')
                .eq('task_id', taskId)
                .eq('influencer_id', profile.id)
                .single()

            if (subData) {
                setSubmission(subData)
                setPostUrl(subData.post_url)
            }
        } catch (error) {
            console.error('Error loading task:', error)
            showAlert?.('Ошибка загрузки задания')
            navigate(-1)
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()

        if (!postUrl) {
            showAlert?.('Введите ссылку на публикацию')
            return
        }

        // Проверка формата ссылки Instagram
        const instagramRegex = /^https?:\/\/(www\.)?instagram\.com\/(p|reel)\/[A-Za-z0-9_-]+\/?/
        if (!instagramRegex.test(postUrl)) {
            showAlert?.('Введите корректную ссылку на публикацию Instagram')
            return
        }

        setLoading(true)
        try {
            let instagramMediaId = null
            let initialMetrics = {
                views: 0,
                likes: 0,
                comments: 0,
                captured_at: Math.floor(Date.now() / 1000)
            }

            // В автоматическом режиме требуем Instagram подключение
            if (!isManualMode) {
                // Получаем Instagram токен и IG user id из профиля инфлюенсера
                const { data: influencerProfile, error: influencerProfileError } = await supabase
                    .from('influencer_profiles')
                    .select('instagram_connected, instagram_access_token, instagram_user_id, instagram_username')
                    .eq('user_id', profile.id)
                    .maybeSingle()

                if (influencerProfileError) throw influencerProfileError

                if (!influencerProfile?.instagram_connected || !influencerProfile?.instagram_access_token) {
                    showAlert?.('Сначала подключите Instagram в профиле')
                    setLoading(false)
                    return
                }

                // Пытаемся получить media_id + базовые метрики на момент отправки
                let metrics = null
                try {
                    metrics = await instagramMetricsService.getPostMetrics(
                        influencerProfile.instagram_access_token,
                        postUrl,
                        influencerProfile.instagram_user_id
                    )
                } catch (e) {
                    console.warn('Could not fetch initial instagram metrics:', e)
                }

                instagramMediaId = metrics?.media_id || null
                initialMetrics = {
                    views: metrics?.views || 0,
                    likes: metrics?.likes_count || 0,
                    comments: metrics?.comments_count || 0,
                    captured_at: Math.floor(Date.now() / 1000)
                }
            }

            if (submission) {
                // Обновляем существующий сабмишен
                const { error } = await supabase
                    .from('task_submissions')
                    .update({
                        post_url: postUrl,
                        instagram_media_id: instagramMediaId,
                        initial_metrics: initialMetrics
                    })
                    .eq('id', submission.id)

                if (error) throw error
                showAlert?.('Ссылка обновлена!')
            } else {
                // Создаем новый сабмишен
                const { error } = await supabase
                    .from('task_submissions')
                    .insert([{
                        task_id: taskId,
                        influencer_id: profile.id,
                        post_url: postUrl,
                        description: 'Отчет о выполнении задания',
                        instagram_media_id: instagramMediaId,
                        initial_metrics: initialMetrics,
                        status: 'pending'
                    }])

                if (error) throw error
                showAlert?.('Публикация отправлена на проверку заказчику!')
            }

            navigate(`/influencer/task/${taskId}`)
        } catch (error) {
            console.error('Error submitting post:', error)
            showAlert?.('Ошибка отправки публикации')
        } finally {
            setLoading(false)
        }
    }

    if (!task) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <p>Загрузка...</p>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-tg-bg pb-20 overflow-x-hidden">
            <div className="max-w-2xl mx-auto p-4">
                <div className="flex items-center justify-between mb-6">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                    >
                        ← Назад
                    </button>
                    <Logo />
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 mb-4">
                    <h1 className="text-2xl font-bold mb-4">📤 Отправка публикации</h1>

                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 mb-6">
                        <h3 className="font-semibold mb-2 break-words">{task.title}</h3>
                        <p className="text-sm text-tg-hint mb-2 break-words">{task.description}</p>
                        <p className="text-tg-button font-semibold">{formatTaskBudget(task)}</p>

                        {task.deadline && (
                            <p className="text-sm text-orange-600 dark:text-orange-400 mt-2">
                                ⏰ Дедлайн: {new Date(task.deadline).toLocaleDateString('ru-RU', {
                                    day: 'numeric',
                                    month: 'long',
                                    year: 'numeric'
                                })}
                            </p>
                        )}
                    </div>

                    {task.target_metrics && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 mb-6">
                            <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-3">
                                🎯 Цели по метрикам (прирост после публикации)
                            </h3>
                            <div className="space-y-2">
                                {task.target_metrics.views && (
                                    <div className="flex justify-between">
                                        <span className="text-sm">👁 Просмотры (прирост):</span>
                                        <span className="font-semibold">{task.target_metrics.views.toLocaleString()}</span>
                                    </div>
                                )}
                                {task.target_metrics.likes && (
                                    <div className="flex justify-between">
                                        <span className="text-sm">❤️ Лайки (прирост):</span>
                                        <span className="font-semibold">{task.target_metrics.likes.toLocaleString()}</span>
                                    </div>
                                )}
                                {task.target_metrics.comments && (
                                    <div className="flex justify-between">
                                        <span className="text-sm">💬 Комментарии (прирост):</span>
                                        <span className="font-semibold">{task.target_metrics.comments.toLocaleString()}</span>
                                    </div>
                                )}
                            </div>
                            <p className="text-xs text-tg-hint mt-3">
                                ℹ️ {isManualMode
                                    ? 'Заказчик введёт метрики вручную при проверке'
                                    : 'Система автоматически отслеживает прогресс и фиксирует оплату по достигнутым порогам'
                                }
                            </p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Ссылка на публикацию Instagram
                            </label>
                            <input
                                type="url"
                                value={postUrl}
                                onChange={(e) => setPostUrl(e.target.value)}
                                className="w-full p-3 rounded-lg border dark:bg-gray-700 dark:border-gray-600"
                                placeholder="https://www.instagram.com/p/..."
                                required
                            />
                            <p className="text-xs text-tg-hint mt-1">
                                Скопируйте ссылку на опубликованный пост или рил
                            </p>
                        </div>

                        {submission && ['in_progress', 'completed'].includes(submission.status) && submission.current_metrics && (
                            <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4">
                                <h4 className="font-semibold text-green-900 dark:text-green-200 mb-2">
                                    📊 Текущий прогресс
                                </h4>
                                <div className="space-y-2">
                                    {submission.current_metrics.views !== undefined && submission.current_metrics.views !== null && (
                                        <div>
                                            <div className="flex justify-between text-sm mb-1">
                                                <span>👁 Просмотры (прирост)</span>
                                                <span>{submission.current_metrics.views.toLocaleString()} / {task.target_metrics?.views?.toLocaleString() || 0}</span>
                                            </div>
                                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                                <div
                                                    className="bg-green-500 h-2 rounded-full"
                                                    style={{ width: `${task.target_metrics?.views ? Math.min((submission.current_metrics.views / task.target_metrics.views * 100), 100) : 0}%` }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <p className="text-sm text-green-800 dark:text-green-200 mt-3">
                                    Общий прогресс: {submission.progress?.toFixed(1)}%
                                </p>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-tg-button text-white py-3 rounded-xl font-medium hover:opacity-90 disabled:opacity-50"
                        >
                            {loading ? 'Отправка...' : submission ? 'Обновить ссылку' : 'Отправить публикацию'}
                        </button>
                    </form>

                    <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
                        <h4 className="font-semibold text-amber-900 dark:text-amber-200 mb-2">
                            📝 Инструкция
                        </h4>
                        <ol className="text-sm text-gray-700 dark:text-gray-300 space-y-1 list-decimal list-inside">
                            <li>Создайте публикацию в Instagram согласно заданию</li>
                            <li>Скопируйте ссылку на публикацию (кнопка "Поделиться" → "Скопировать ссылку")</li>
                            <li>Вставьте ссылку в поле выше и нажмите "Отправить"</li>
                            {isManualMode ? (
                                <>
                                    <li>Заказчик проверит публикацию и введёт метрики</li>
                                    <li>После подтверждения вы получите оплату</li>
                                </>
                            ) : (
                                <>
                                    <li>Система начнет автоматически отслеживать метрики</li>
                                    <li>При достижении целей задание автоматически завершится и вы получите оплату</li>
                                </>
                            )}
                        </ol>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default SubmitTaskPost
