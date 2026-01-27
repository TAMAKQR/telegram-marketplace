import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useUserStore } from '../store/userStore'
import { useTelegram } from '../hooks/useTelegram'
import Logo from '../components/Logo'

function ReviewSubmission() {
    const navigate = useNavigate()
    const { taskId } = useParams()
    const { profile } = useUserStore()
    const { showAlert } = useTelegram()

    const [loading, setLoading] = useState(false)
    const [task, setTask] = useState(null)
    const [submission, setSubmission] = useState(null)

    useEffect(() => {
        if (!taskId || !profile?.id) return
        loadTaskAndSubmission()
    }, [taskId, profile?.id])

    const loadTaskAndSubmission = async () => {
        try {
            if (!profile?.id) {
                console.log('ReviewSubmission: waiting for profile...')
                return
            }

            // Загружаем задание
            const { data: taskData, error: taskError } = await supabase
                .from('tasks')
                .select('*')
                .eq('id', taskId)
                .eq('client_id', profile.id)
                .single()

            if (taskError) throw taskError
            setTask(taskData)

            // Загружаем сабмишен на проверке
            const { data: subData, error: subError } = await supabase
                .from('task_submissions')
                .select(`
                    *,
                    users:influencer_id(first_name, last_name, telegram_id)
                `)
                .eq('task_id', taskId)
                .eq('status', 'pending')
                .order('created_at', { descending: true })
                .limit(1)
                .maybeSingle()

            console.log('ReviewSubmission - loaded data:', subData)
            console.log('ReviewSubmission - error:', subError)
            console.log('ReviewSubmission - users field:', subData?.users)

            if (subError) throw subError

            if (!subData) {
                console.warn('No pending submission found for task:', taskId)
                showAlert?.('Нет публикаций на проверке')
                navigate(-1)
                return
            }

            setSubmission(subData)
        } catch (error) {
            console.error('Error in ReviewSubmission loadTaskAndSubmission:', error)
            showAlert?.('Ошибка загрузки')
            navigate(-1)
        }
    }

    const handleApprove = async () => {
        if (!submission) {
            console.error('handleApprove called but submission is null')
            return
        }

        if (!profile?.id) {
            showAlert?.('Профиль не загружен, попробуйте еще раз')
            return
        }

        setLoading(true)
        try {
            const { data, error } = await supabase.rpc('approve_submission', {
                p_submission_id: submission.id,
                p_client_id: profile.id,
                p_approved: true
            })

            if (error) throw error

            // Обновляем статус задания на in_progress
            await supabase
                .from('tasks')
                .update({ status: 'in_progress' })
                .eq('id', taskId)

            showAlert?.('Публикация одобрена! Началось отслеживание метрик.')
            navigate(`/client/task/${taskId}`)
        } catch (error) {
            console.error('Error approving:', error)
            showAlert?.('Ошибка: ' + error.message)
        } finally {
            setLoading(false)
        }
    }

    const handleReject = async () => {
        if (!submission) {
            console.error('handleReject called but submission is null')
            return
        }

        if (!profile?.id) {
            showAlert?.('Профиль не загружен, попробуйте еще раз')
            return
        }

        const reason = prompt('Укажите причину отклонения:')
        if (!reason) return

        setLoading(true)
        try {
            const { data, error } = await supabase.rpc('approve_submission', {
                p_submission_id: submission.id,
                p_client_id: profile.id,
                p_approved: false,
                p_rejection_reason: reason
            })

            if (error) throw error

            showAlert?.('Публикация отклонена')
            navigate(`/client/task/${taskId}`)
        } catch (error) {
            console.error('Error rejecting:', error)
            showAlert?.('Ошибка: ' + error.message)
        } finally {
            setLoading(false)
        }
    }

    if (!task || !submission) {
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
                    <h1 className="text-2xl font-bold mb-4">🔍 Проверка публикации</h1>

                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 mb-6">
                        <h3 className="font-semibold mb-2 break-words">{task.title}</h3>
                        <p className="text-sm text-tg-hint">💰 Бюджет: {task.budget.toLocaleString()} сом</p>
                    </div>

                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 mb-6">
                        <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-3">
                            📸 Информация об инфлюенсере
                        </h3>
                        <p className="text-sm">
                            {submission.users?.first_name} {submission.users?.last_name}
                        </p>
                        <p className="text-xs text-tg-hint">
                            Telegram: {submission.users?.telegram_id}
                        </p>
                    </div>

                    {task.target_metrics && (
                        <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 mb-6">
                            <h3 className="font-semibold text-green-900 dark:text-green-200 mb-3">
                                🎯 Целевые метрики
                            </h3>
                            <div className="space-y-2">
                                {task.target_metrics.views && (
                                    <div className="flex justify-between">
                                        <span className="text-sm">👁 Просмотры:</span>
                                        <span className="font-semibold">{task.target_metrics.views.toLocaleString()}</span>
                                    </div>
                                )}
                                {task.target_metrics.likes && (
                                    <div className="flex justify-between">
                                        <span className="text-sm">❤️ Лайки:</span>
                                        <span className="font-semibold">{task.target_metrics.likes.toLocaleString()}</span>
                                    </div>
                                )}
                                {task.target_metrics.comments && (
                                    <div className="flex justify-between">
                                        <span className="text-sm">💬 Комментарии:</span>
                                        <span className="font-semibold">{task.target_metrics.comments.toLocaleString()}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 mb-6">
                        <h3 className="font-semibold text-purple-900 dark:text-purple-200 mb-3">
                            🔗 Ссылка на публикацию
                        </h3>
                        <a
                            href={submission.post_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 dark:text-blue-400 hover:underline break-all block"
                        >
                            {submission.post_url}
                        </a>
                        <p className="text-xs text-tg-hint mt-2">
                            Отправлено: {new Date(submission.submitted_at).toLocaleDateString('ru-RU', {
                                day: 'numeric',
                                month: 'long',
                                hour: '2-digit',
                                minute: '2-digit'
                            })}
                        </p>
                    </div>

                    {submission.status === 'pending' && (
                        <div className="space-y-3">
                            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-200 dark:border-amber-800 mb-4">
                                <h4 className="font-semibold text-amber-900 dark:text-amber-200 mb-2">
                                    ⚠️ Важно проверить
                                </h4>
                                <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1 list-disc list-inside">
                                    <li><strong>Откройте публикацию в Instagram</strong> - убедитесь что она реальная</li>
                                    <li><strong>Проверьте автора</strong> - публикация должна быть с аккаунта инфлюенсера</li>
                                    <li><strong>Проверьте дату</strong> - пост должен быть новым (созданным после принятия задания)</li>
                                    <li><strong>Проверьте контент</strong> - соответствие заданию и качество</li>
                                    <li>После одобрения начнется автоматическое отслеживание метрик</li>
                                    <li>При достижении целей инфлюенсер автоматически получит оплату</li>
                                </ul>
                            </div>

                            <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-3 border border-red-200 dark:border-red-800 mb-4">
                                <p className="text-xs text-red-800 dark:text-red-200">
                                    🛡️ <strong>Защита от мошенничества:</strong> Система автоматически проверяет владельца поста через Instagram API.
                                    Если пост чужой - он будет автоматически отклонен.
                                </p>
                            </div>

                            <button
                                onClick={handleApprove}
                                disabled={loading}
                                className="w-full bg-green-500 text-white py-4 rounded-xl font-semibold hover:bg-green-600 disabled:opacity-50"
                            >
                                ✅ Одобрить и начать отслеживание
                            </button>

                            <button
                                onClick={handleReject}
                                disabled={loading}
                                className="w-full bg-red-500 text-white py-4 rounded-xl font-semibold hover:bg-red-600 disabled:opacity-50"
                            >
                                ❌ Отклонить публикацию
                            </button>
                        </div>
                    )}

                    {submission.status === 'in_progress' && (
                        <div className="bg-blue-100 dark:bg-blue-900/30 rounded-xl p-4 text-center">
                            <p className="text-blue-800 dark:text-blue-200 font-semibold">
                                📊 Отслеживание метрик активно
                            </p>
                            <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                                Система автоматически проверяет метрики каждый час
                            </p>
                        </div>
                    )}

                    {submission.status === 'approved' && (
                        <div className="bg-green-100 dark:bg-green-900/30 rounded-xl p-4 text-center">
                            <p className="text-green-800 dark:text-green-200 font-semibold">
                                ✅ Публикация одобрена
                            </p>
                            <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                                Идет отслеживание метрик
                            </p>
                        </div>
                    )}

                    {submission.status === 'rejected' && (
                        <div className="bg-red-100 dark:bg-red-900/30 rounded-xl p-4 text-center">
                            <p className="text-red-800 dark:text-red-200 font-semibold">
                                ❌ Публикация отклонена
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default ReviewSubmission
