import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useUserStore } from '../store/userStore'
import { useTelegram } from '../hooks/useTelegram'
import Logo from '../components/Logo'

function EditTask() {
    const { taskId } = useParams()
    const navigate = useNavigate()
    const { showAlert } = useTelegram()
    const { profile } = useUserStore()
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [taskStatus, setTaskStatus] = useState(null)

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        budget: '',
        deadline: '',
        minFollowers: '',
        minEngagementRate: ''
    })

    useEffect(() => {
        loadTask()
    }, [taskId])

    const loadTask = async () => {
        try {
            const { data, error } = await supabase
                .from('tasks')
                .select('*')
                .eq('id', taskId)
                .single()

            if (error) throw error

            // Проверка прав доступа
            if (data.client_id !== profile?.id) {
                showAlert?.('У вас нет прав для редактирования этого задания')
                navigate(-1)
                return
            }

            // Сохраняем статус для проверки при редактировании
            // Удалять можно любое задание
            // Редактировать - только open и in_progress
            setTaskStatus(data.status)

            setFormData({
                title: data.title || '',
                description: data.description || '',
                budget: data.budget?.toString() || '',
                deadline: data.deadline ? data.deadline.split('T')[0] : '',
                minFollowers: data.requirements?.minFollowers?.toString() || '',
                minEngagementRate: data.requirements?.minEngagementRate?.toString() || ''
            })
        } catch (error) {
            console.error('Ошибка загрузки задания:', error)
            showAlert?.('Ошибка загрузки задания')
            navigate(-1)
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()

        // Проверяем можно ли редактировать по статусу
        const { data: currentTask } = await supabase
            .from('tasks')
            .select('status')
            .eq('id', taskId)
            .single()

        if (currentTask && !['open', 'in_progress'].includes(currentTask.status)) {
            showAlert?.('Можно редактировать только открытые задания или задания в работе')
            return
        }

        if (!formData.title || !formData.description || !formData.budget) {
            showAlert?.('Заполните все обязательные поля')
            return
        }

        const budget = parseFloat(formData.budget)
        if (isNaN(budget) || budget <= 0) {
            showAlert?.('Введите корректный бюджет')
            return
        }

        setSubmitting(true)
        try {
            const requirements = {}
            if (formData.minFollowers) {
                requirements.minFollowers = parseInt(formData.minFollowers)
            }
            if (formData.minEngagementRate) {
                requirements.minEngagementRate = parseFloat(formData.minEngagementRate)
            }

            const { error } = await supabase
                .from('tasks')
                .update({
                    title: formData.title,
                    description: formData.description,
                    budget: budget,
                    deadline: formData.deadline || null,
                    requirements: Object.keys(requirements).length > 0 ? requirements : null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', taskId)

            if (error) throw error

            showAlert?.('Задание успешно обновлено!')
            navigate(`/task/${taskId}`)
        } catch (error) {
            console.error('Ошибка обновления:', error)
            showAlert?.('Ошибка при обновлении задания')
        } finally {
            setSubmitting(false)
        }
    }

    const handleDelete = async () => {
        if (!window.confirm('Вы уверены, что хотите удалить это задание? Средства будут возвращены на баланс.')) {
            return
        }

        setSubmitting(true)
        try {
            const { data, error } = await supabase
                .rpc('client_delete_task', {
                    p_task_id: taskId,
                    p_client_id: profile?.id
                })

            if (error) throw error

            showAlert?.('Задание успешно удалено, средства возвращены на баланс')
            navigate('/client-dashboard')
        } catch (error) {
            console.error('Ошибка удаления:', error)
            showAlert?.('Ошибка при удалении задания: ' + (error.message || 'Неизвестная ошибка'))
        } finally {
            setSubmitting(false)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-tg-hint">Загрузка...</div>
            </div>
        )
    }

    return (
        <div className="min-h-screen pb-6 overflow-x-hidden">
            {/* Header */}
            <div className="bg-brand-gradient text-white p-4 pt-8">
                <div className="flex items-center gap-3">
                    <Logo className="h-7 w-auto" />
                    <button onClick={() => navigate(-1)} className="text-2xl">←</button>
                    <h1 className="text-xl font-bold">Редактировать задание</h1>
                </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            Название задания <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            className="w-full p-3 rounded-lg border dark:bg-gray-700 dark:border-gray-600"
                            placeholder="Например: Рекламный пост для отеля"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">
                            Описание <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            className="w-full p-3 rounded-lg border dark:bg-gray-700 dark:border-gray-600"
                            rows="5"
                            placeholder="Подробно опишите задание..."
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">
                            Бюджет (сом) <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="number"
                            value={formData.budget}
                            onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                            className="w-full p-3 rounded-lg border dark:bg-gray-700 dark:border-gray-600"
                            placeholder="1000"
                            min="1"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">
                            Дедлайн
                        </label>
                        <input
                            type="date"
                            value={formData.deadline}
                            onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                            className="w-full p-3 rounded-lg border dark:bg-gray-700 dark:border-gray-600"
                            min={new Date().toISOString().split('T')[0]}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">
                            Минимум подписчиков
                        </label>
                        <input
                            type="number"
                            value={formData.minFollowers}
                            onChange={(e) => setFormData({ ...formData, minFollowers: e.target.value })}
                            className="w-full p-3 rounded-lg border dark:bg-gray-700 dark:border-gray-600"
                            placeholder="1000"
                            min="0"
                        />
                        <p className="text-xs text-tg-hint mt-1">
                            Инфлюенсеры с меньшим количеством подписчиков не смогут откликнуться
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">
                            Минимальная вовлеченность (%)
                        </label>
                        <input
                            type="number"
                            value={formData.minEngagementRate}
                            onChange={(e) => setFormData({ ...formData, minEngagementRate: e.target.value })}
                            className="w-full p-3 rounded-lg border dark:bg-gray-700 dark:border-gray-600"
                            placeholder="2.5"
                            min="0"
                            max="100"
                            step="0.1"
                        />
                        <p className="text-xs text-tg-hint mt-1">
                            Engagement Rate — процент взаимодействий (лайки, комментарии) от числа подписчиков
                        </p>
                    </div>
                </div>

                {/* Кнопки */}
                {['open', 'in_progress'].includes(taskStatus) && (
                    <button
                        type="submit"
                        disabled={submitting}
                        className="w-full bg-brand text-white py-3 rounded-xl font-semibold hover:bg-brand/90 transition-colors disabled:opacity-50"
                    >
                        {submitting ? 'Сохранение...' : 'Сохранить изменения'}
                    </button>
                )}

                {taskStatus === 'completed' && (
                    <div className="bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-500 rounded-xl p-4 text-center">
                        <p className="text-sm text-yellow-800 dark:text-yellow-200">
                            ⚠️ Задание завершено. Редактирование недоступно.<br />
                            Можно только удалить (без возврата средств)
                        </p>
                    </div>
                )}

                <button
                    type="button"
                    onClick={handleDelete}
                    disabled={submitting}
                    className="w-full bg-red-500 text-white py-3 rounded-xl font-semibold hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                    🗑️ Удалить задание {taskStatus === 'completed' ? '(без возврата)' : '(с возвратом средств)'}
                </button>
            </form>
        </div>
    )
}

export default EditTask
