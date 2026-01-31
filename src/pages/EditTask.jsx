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
        minEngagementRate: '',
        targetViews: '',
        targetLikes: '',
        targetComments: '',
        metricDeadlineDays: '7',
        maxInfluencers: '',
        usePricingTiers: false
    })

    const [pricingTiers, setPricingTiers] = useState([
        { min: '', max: '', price: '', metric: 'views' }
    ])

    const parseOptionalInt = (value) => {
        if (value === null || value === undefined) return null
        const trimmed = String(value).trim()
        if (trimmed === '') return null
        const parsed = parseInt(trimmed, 10)
        return Number.isFinite(parsed) ? parsed : null
    }

    const parseOptionalNumber = (value) => {
        if (value === null || value === undefined) return null
        const trimmed = String(value).trim()
        if (trimmed === '') return null
        const parsed = parseFloat(trimmed)
        return Number.isFinite(parsed) ? parsed : null
    }

    const metricLabel = (metric) => {
        switch (metric) {
            case 'views': return 'Просмотры'
            case 'likes': return 'Лайки'
            case 'comments': return 'Комментарии'
            default: return metric
        }
    }

    const normalizePricingTiers = (tiers) => {
        const normalized = tiers.map((tier) => {
            const min = parseOptionalInt(tier.min)
            const max = parseOptionalInt(tier.max)
            const price = parseOptionalNumber(tier.price)
            return {
                metric: tier.metric || 'views',
                min,
                max,
                price,
            }
        })

        const errors = Array.from({ length: tiers.length }, () => [])

        normalized.forEach((t, idx) => {
            if (t.min === null) errors[idx].push('Укажите "От" (min)')
            if (t.min !== null && t.min < 0) errors[idx].push('"От" не может быть отрицательным')

            if (t.max !== null && t.max < 0) errors[idx].push('"До" не может быть отрицательным')
            if (t.min !== null && t.max !== null && t.max < t.min) errors[idx].push('"До" должно быть ≥ "От"')

            if (t.price === null) errors[idx].push('Укажите цену (можно 0)')
            if (t.price !== null && t.price < 0) errors[idx].push('Цена не может быть отрицательной')
        })

        const seen = new Map()
        normalized.forEach((t, idx) => {
            if (t.min === null) return
            const key = `${t.metric}:${t.min}`
            const list = seen.get(key) || []
            list.push(idx)
            seen.set(key, list)
        })
        for (const [key, idxs] of seen.entries()) {
            if (idxs.length <= 1) continue
            const [metric, min] = key.split(':')
            idxs.forEach((i) => {
                errors[i].push(`Дубликат порога: ${metricLabel(metric)} от ${Number(min).toLocaleString()}`)
            })
        }

        return { normalized, errors }
    }

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

            const usePricingTiers = Array.isArray(data.pricing_tiers) && data.pricing_tiers.length > 0
            const targetMetrics = data.target_metrics || {}

            if (usePricingTiers) {
                const tiers = data.pricing_tiers.map((t) => ({
                    metric: t.metric || 'views',
                    min: t.min === null || t.min === undefined ? '' : String(t.min),
                    max: t.max === null || t.max === undefined ? '' : String(t.max),
                    price: t.price === null || t.price === undefined ? '' : String(t.price),
                }))
                setPricingTiers(tiers.length > 0 ? tiers : [{ min: '', max: '', price: '', metric: 'views' }])
            } else {
                setPricingTiers([{ min: '', max: '', price: '', metric: 'views' }])
            }

            setFormData({
                title: data.title || '',
                description: data.description || '',
                budget: data.budget?.toString() || '',
                deadline: data.deadline ? data.deadline.split('T')[0] : '',
                minFollowers: data.requirements?.minFollowers?.toString() || '',
                minEngagementRate: data.requirements?.minEngagementRate?.toString() || '',
                targetViews: targetMetrics.views !== undefined && targetMetrics.views !== null ? String(targetMetrics.views) : '',
                targetLikes: targetMetrics.likes !== undefined && targetMetrics.likes !== null ? String(targetMetrics.likes) : '',
                targetComments: targetMetrics.comments !== undefined && targetMetrics.comments !== null ? String(targetMetrics.comments) : '',
                metricDeadlineDays: data.metric_deadline_days !== undefined && data.metric_deadline_days !== null ? String(data.metric_deadline_days) : '7',
                maxInfluencers: data.max_influencers !== undefined && data.max_influencers !== null ? String(data.max_influencers) : '',
                usePricingTiers
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

        if (!formData.title || !formData.description) {
            showAlert?.('Заполните все обязательные поля')
            return
        }

        const canEditEconomicFields = currentTask && currentTask.status === 'open'

        // Если уже in_progress — не даём менять pricing tiers/target_metrics/лимиты, но даём править описание и т.д.
        if (!canEditEconomicFields) {
            // принудительно держим экономические поля неизменными (они уже загружены в formData/pricingTiers)
        }

        let budget = null
        if (!formData.usePricingTiers) {
            if (!formData.budget) {
                showAlert?.('Заполните все обязательные поля')
                return
            }

            budget = parseFloat(formData.budget)
            if (isNaN(budget) || budget <= 0) {
                showAlert?.('Введите корректный бюджет')
                return
            }
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

            let pricing_tiers = null
            let target_metrics = null
            let metric_deadline_days = null
            let max_influencers = null

            if (canEditEconomicFields) {
                metric_deadline_days = parseInt(formData.metricDeadlineDays, 10) || 7
                max_influencers = formData.maxInfluencers ? parseInt(formData.maxInfluencers, 10) : null

                if (formData.usePricingTiers) {
                    const { normalized, errors } = normalizePricingTiers(pricingTiers)
                    const firstError = errors.flat().find(Boolean)
                    if (firstError) {
                        showAlert?.(firstError)
                        return
                    }

                    pricing_tiers = normalized

                    // Автоматически генерируем target_metrics из МИНИМАЛЬНЫХ значений pricing_tiers
                    const minMetrics = {}
                    pricing_tiers.forEach((tier) => {
                        if (tier.min === null || tier.min === undefined) return
                        const currentMin = minMetrics[tier.metric]
                        if (currentMin === undefined || tier.min < currentMin) {
                            minMetrics[tier.metric] = tier.min
                        }
                    })
                    target_metrics = Object.keys(minMetrics).length > 0 ? minMetrics : null
                } else {
                    const views = parseOptionalInt(formData.targetViews)
                    const likes = parseOptionalInt(formData.targetLikes)
                    const comments = parseOptionalInt(formData.targetComments)

                    const tm = {}
                    if (views !== null) tm.views = views
                    if (likes !== null) tm.likes = likes
                    if (comments !== null) tm.comments = comments

                    target_metrics = Object.keys(tm).length > 0 ? tm : null
                    pricing_tiers = null
                }
            }

            const { error } = await supabase
                .from('tasks')
                .update({
                    title: formData.title,
                    description: formData.description,
                    budget: canEditEconomicFields ? (formData.usePricingTiers ? 0 : budget) : undefined,
                    deadline: formData.deadline || null,
                    requirements: Object.keys(requirements).length > 0 ? requirements : null,
                    pricing_tiers: canEditEconomicFields ? pricing_tiers : undefined,
                    target_metrics: canEditEconomicFields ? target_metrics : undefined,
                    metric_deadline_days: canEditEconomicFields ? metric_deadline_days : undefined,
                    max_influencers: canEditEconomicFields ? max_influencers : undefined,
                    updated_at: new Date().toISOString()
                })
                .eq('id', taskId)

            if (error) throw error

            showAlert?.('Задание успешно обновлено!')
            navigate(`/client/task/${taskId}`)
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
                            required={!formData.usePricingTiers}
                            disabled={formData.usePricingTiers}
                        />
                        {formData.usePricingTiers && (
                            <p className="text-xs text-tg-hint mt-1">
                                Для заданий с ценовыми диапазонами бюджет фиксируется как 0 — выплаты идут по "лесенке" из pricing tiers.
                            </p>
                        )}
                    </div>

                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <label className="block text-sm font-medium mb-1">Ценовые диапазоны (лесенка)</label>
                            <p className="text-xs text-tg-hint">
                                Если включено — выплаты считаются по порогам просмотров/лайков/комментариев.
                            </p>
                        </div>
                        <input
                            type="checkbox"
                            checked={formData.usePricingTiers}
                            onChange={(e) => setFormData({ ...formData, usePricingTiers: e.target.checked })}
                            disabled={taskStatus !== 'open'}
                            className="w-5 h-5"
                        />
                    </div>

                    {taskStatus !== 'open' && (
                        <div className="bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-500 rounded-lg p-3 text-sm">
                            ⚠️ Задание уже в работе. Экономические поля (pricing tiers / цели / лимиты) изменять нельзя, но вы можете изменить текст и дедлайн.
                        </div>
                    )}

                    {formData.usePricingTiers ? (
                        <div className="border-t pt-4">
                            <h3 className="font-semibold mb-3">Ценовые диапазоны</h3>
                            <div className="space-y-3">
                                {pricingTiers.map((tier, idx) => (
                                    <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                                        <div className="col-span-4">
                                            <label className="block text-xs text-tg-hint mb-1">Метрика</label>
                                            <select
                                                value={tier.metric}
                                                onChange={(e) => {
                                                    const next = [...pricingTiers]
                                                    next[idx] = { ...next[idx], metric: e.target.value }
                                                    setPricingTiers(next)
                                                }}
                                                disabled={taskStatus !== 'open'}
                                                className="w-full p-2 rounded-lg border dark:bg-gray-700 dark:border-gray-600"
                                            >
                                                <option value="views">Просмотры</option>
                                                <option value="likes">Лайки</option>
                                                <option value="comments">Комментарии</option>
                                            </select>
                                        </div>
                                        <div className="col-span-2">
                                            <label className="block text-xs text-tg-hint mb-1">От</label>
                                            <input
                                                type="number"
                                                value={tier.min}
                                                onChange={(e) => {
                                                    const next = [...pricingTiers]
                                                    next[idx] = { ...next[idx], min: e.target.value }
                                                    setPricingTiers(next)
                                                }}
                                                disabled={taskStatus !== 'open'}
                                                className="w-full p-2 rounded-lg border dark:bg-gray-700 dark:border-gray-600"
                                                min="0"
                                            />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="block text-xs text-tg-hint mb-1">До (опц.)</label>
                                            <input
                                                type="number"
                                                value={tier.max}
                                                onChange={(e) => {
                                                    const next = [...pricingTiers]
                                                    next[idx] = { ...next[idx], max: e.target.value }
                                                    setPricingTiers(next)
                                                }}
                                                disabled={taskStatus !== 'open'}
                                                className="w-full p-2 rounded-lg border dark:bg-gray-700 dark:border-gray-600"
                                                min="0"
                                                placeholder="∞"
                                            />
                                        </div>
                                        <div className="col-span-3">
                                            <label className="block text-xs text-tg-hint mb-1">Цена (сом)</label>
                                            <input
                                                type="number"
                                                value={tier.price}
                                                onChange={(e) => {
                                                    const next = [...pricingTiers]
                                                    next[idx] = { ...next[idx], price: e.target.value }
                                                    setPricingTiers(next)
                                                }}
                                                disabled={taskStatus !== 'open'}
                                                className="w-full p-2 rounded-lg border dark:bg-gray-700 dark:border-gray-600"
                                                min="0"
                                            />
                                        </div>
                                        <div className="col-span-1 flex justify-end">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const next = pricingTiers.filter((_, i) => i !== idx)
                                                    setPricingTiers(next.length > 0 ? next : [{ min: '', max: '', price: '', metric: 'views' }])
                                                }}
                                                disabled={taskStatus !== 'open'}
                                                className="px-2 py-2 rounded-lg bg-red-500 text-white disabled:opacity-50"
                                                title="Удалить"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    </div>
                                ))}

                                <button
                                    type="button"
                                    onClick={() => setPricingTiers([...pricingTiers, { min: '', max: '', price: '', metric: 'views' }])}
                                    disabled={taskStatus !== 'open'}
                                    className="w-full bg-gray-100 dark:bg-gray-700 py-2 rounded-lg text-sm disabled:opacity-50"
                                >
                                    + Добавить диапазон
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="border-t pt-4">
                            <h3 className="font-semibold mb-3">Цели по метрикам (auto-approve)</h3>
                            <div className="grid grid-cols-1 gap-3">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Просмотры</label>
                                    <input
                                        type="number"
                                        value={formData.targetViews}
                                        onChange={(e) => setFormData({ ...formData, targetViews: e.target.value })}
                                        disabled={taskStatus !== 'open'}
                                        className="w-full p-3 rounded-lg border dark:bg-gray-700 dark:border-gray-600"
                                        placeholder="например 15000"
                                        min="0"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Лайки</label>
                                    <input
                                        type="number"
                                        value={formData.targetLikes}
                                        onChange={(e) => setFormData({ ...formData, targetLikes: e.target.value })}
                                        disabled={taskStatus !== 'open'}
                                        className="w-full p-3 rounded-lg border dark:bg-gray-700 dark:border-gray-600"
                                        placeholder="например 200"
                                        min="0"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Комментарии</label>
                                    <input
                                        type="number"
                                        value={formData.targetComments}
                                        onChange={(e) => setFormData({ ...formData, targetComments: e.target.value })}
                                        disabled={taskStatus !== 'open'}
                                        className="w-full p-3 rounded-lg border dark:bg-gray-700 dark:border-gray-600"
                                        placeholder="например 10"
                                        min="0"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="border-t pt-4">
                        <div className="grid grid-cols-1 gap-3">
                            <div>
                                <label className="block text-sm font-medium mb-1">Срок проверки метрик (дней)</label>
                                <input
                                    type="number"
                                    value={formData.metricDeadlineDays}
                                    onChange={(e) => setFormData({ ...formData, metricDeadlineDays: e.target.value })}
                                    disabled={taskStatus !== 'open'}
                                    className="w-full p-3 rounded-lg border dark:bg-gray-700 dark:border-gray-600"
                                    min="1"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Макс. исполнителей (опц.)</label>
                                <input
                                    type="number"
                                    value={formData.maxInfluencers}
                                    onChange={(e) => setFormData({ ...formData, maxInfluencers: e.target.value })}
                                    disabled={taskStatus !== 'open'}
                                    className="w-full p-3 rounded-lg border dark:bg-gray-700 dark:border-gray-600"
                                    min="1"
                                    placeholder="пусто = без лимита"
                                />
                            </div>
                        </div>
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
