import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useUserStore } from '../store/userStore'
import { useTelegram } from '../hooks/useTelegram'
import { sendTelegramNotificationSilent, formatNewTaskMessage } from '../lib/telegramBot'
import Logo from '../components/Logo'

function CreateTask() {
    const navigate = useNavigate()
    const { showAlert } = useTelegram()
    const { profile } = useUserStore()
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        budget: '',
        minFollowers: '',
        minEngagementRate: '',
        deadline: '',
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

        // basic per-row validation
        normalized.forEach((t, idx) => {
            if (t.min === null) errors[idx].push('Укажите "От" (min)')
            if (t.min !== null && t.min < 0) errors[idx].push('"От" не может быть отрицательным')

            if (t.max !== null && t.max < 0) errors[idx].push('"До" не может быть отрицательным')
            if (t.min !== null && t.max !== null && t.max < t.min) errors[idx].push('"До" должно быть ≥ "От"')

            if (t.price === null) errors[idx].push('Укажите цену (можно 0)')
            if (t.price !== null && t.price < 0) errors[idx].push('Цена не может быть отрицательной')
        })

        // duplicates of (metric, min)
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

        // soft warning for overlaps when max is used
        const byMetric = normalized
            .map((t, idx) => ({ ...t, _idx: idx }))
            .filter(t => t.min !== null)
            .reduce((acc, t) => {
                acc[t.metric] = acc[t.metric] || []
                acc[t.metric].push(t)
                return acc
            }, {})

        Object.keys(byMetric).forEach(metric => {
            const rows = byMetric[metric]
                .filter(r => r.max !== null)
                .sort((a, b) => a.min - b.min)

            for (let i = 1; i < rows.length; i++) {
                const prev = rows[i - 1]
                const cur = rows[i]
                if (prev.max >= cur.min) {
                    errors[cur._idx].push('Пересечение диапазонов (лесенка всё равно сработает, но лучше разнести)')
                }
            }
        })

        const valid = normalized.filter((t, idx) => {
            // Keep only rows that user intended to fill: require min + price.
            // Metric is always present.
            if (t.min === null && t.price === null && t.max === null) return false
            return errors[idx].length === 0
        })

        const hasBlockingErrors = errors.some(e => e.length > 0)
        return { normalized, errors, valid, hasBlockingErrors }
    }

    const addPricingTier = () => {
        setPricingTiers([...pricingTiers, { min: '', max: '', price: '', metric: 'views' }])
    }

    const addNextPricingTier = () => {
        const last = pricingTiers[pricingTiers.length - 1] || { min: '', max: '', price: '', metric: 'views' }
        const lastMin = parseOptionalInt(last.min)
        const lastMax = parseOptionalInt(last.max)
        const nextMin = lastMax !== null ? String(lastMax + 1) : (lastMin !== null ? String(lastMin) : '')

        setPricingTiers([
            ...pricingTiers,
            { min: nextMin, max: '', price: '', metric: last.metric || 'views' }
        ])
    }

    const sortPricingTiers = () => {
        const order = { views: 0, likes: 1, comments: 2 }
        const sorted = [...pricingTiers].sort((a, b) => {
            const metricDiff = (order[a.metric] ?? 99) - (order[b.metric] ?? 99)
            if (metricDiff !== 0) return metricDiff
            const amin = parseOptionalInt(a.min)
            const bmin = parseOptionalInt(b.min)
            if (amin === null && bmin === null) return 0
            if (amin === null) return 1
            if (bmin === null) return -1
            return amin - bmin
        })
        setPricingTiers(sorted)
    }

    const removePricingTier = (index) => {
        setPricingTiers(pricingTiers.filter((_, i) => i !== index))
    }

    const updatePricingTier = (index, field, value) => {
        const updated = [...pricingTiers]
        updated[index][field] = value
        setPricingTiers(updated)
    }

    const handleSubmit = async (e) => {
        e.preventDefault()

        // Проверяем обязательные поля
        if (!formData.title || !formData.description) {
            showAlert?.('Заполните все обязательные поля')
            return
        }

        // Проверяем дедлайн
        if (!formData.deadline) {
            showAlert?.('Укажите дедлайн выполнения задания')
            return
        }

        // Проверяем что дедлайн не в прошлом
        if (new Date(formData.deadline) < new Date()) {
            showAlert?.('Дедлайн не может быть в прошлом')
            return
        }

        // Проверяем budget только если не используются pricing tiers
        if (!formData.usePricingTiers && !formData.budget) {
            showAlert?.('Укажите бюджет задания')
            return
        }

        // Если используются pricing tiers - валидируем лесенку
        if (formData.usePricingTiers) {
            const { valid, hasBlockingErrors } = normalizePricingTiers(pricingTiers)

            if (valid.length === 0) {
                showAlert?.('Добавьте хотя бы один корректный порог (min + цена). Поле "До" можно оставить пустым.')
                return
            }

            if (hasBlockingErrors) {
                showAlert?.('Есть ошибки в ценовых диапазонах. Проверьте подсказки под полями.')
                return
            }
        }

        setLoading(true)
        try {
            const requirements = {}
            if (formData.minFollowers) {
                requirements.minFollowers = parseInt(formData.minFollowers)
            }
            if (formData.minEngagementRate) {
                requirements.minEngagementRate = parseFloat(formData.minEngagementRate)
            }

            const targetMetrics = {}
            if (formData.targetViews) {
                targetMetrics.views = parseInt(formData.targetViews)
            }
            if (formData.targetLikes) {
                targetMetrics.likes = parseInt(formData.targetLikes)
            }
            if (formData.targetComments) {
                targetMetrics.comments = parseInt(formData.targetComments)
            }

            // Подготавливаем pricing_tiers если они используются
            let finalPricingTiers = null
            if (formData.usePricingTiers) {
                const { valid } = normalizePricingTiers(pricingTiers)
                finalPricingTiers = valid.map(tier => ({
                    min: tier.min,
                    max: tier.max, // может быть null (до бесконечности)
                    price: tier.price,
                    metric: tier.metric
                }))

                // Автоматически генерируем target_metrics из МИНИМАЛЬНЫХ значений pricing_tiers
                // Автоодобрение происходит при достижении минимального порога
                const minMetrics = {}
                finalPricingTiers.forEach(tier => {
                    const currentMin = minMetrics[tier.metric]
                    if (currentMin === undefined || tier.min < currentMin) {
                        minMetrics[tier.metric] = tier.min
                    }
                })

                // Устанавливаем target_metrics с минимальными значениями из pricing_tiers
                Object.keys(minMetrics).forEach(metric => {
                    targetMetrics[metric] = minMetrics[metric]
                })
            }

            const { data, error } = await supabase
                .from('tasks')
                .insert([
                    {
                        client_id: profile.id,
                        title: formData.title,
                        description: formData.description,
                        budget: formData.usePricingTiers ? 0 : parseFloat(formData.budget),
                        requirements: Object.keys(requirements).length > 0 ? requirements : null,
                        target_metrics: Object.keys(targetMetrics).length > 0 ? targetMetrics : null,
                        pricing_tiers: finalPricingTiers,
                        metric_deadline_days: parseInt(formData.metricDeadlineDays) || 7,
                        max_influencers: formData.maxInfluencers ? parseInt(formData.maxInfluencers) : null,
                        deadline: formData.deadline || null,
                        status: 'open',
                        accepted_count: 0
                    }
                ])
                .select()
                .single()

            if (error) throw error

            // Отправляем уведомление в группу
            try {
                const clientName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Заказчик'
                const message = formatNewTaskMessage(data, clientName)
                await sendTelegramNotificationSilent(message)
            } catch (notificationError) {
                console.error('Ошибка отправки уведомления:', notificationError)
                // Не показываем ошибку пользователю, задание создалось успешно
            }

            showAlert?.('Задание успешно создано!')
            navigate('/client')
        } catch (error) {
            console.error('Ошибка создания задания:', error)
            showAlert?.('Произошла ошибка. Попробуйте снова.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen pb-6 overflow-x-hidden">
            {/* Header */}
            <div className="bg-brand-gradient text-white p-4 pt-8">
                <div className="flex items-center gap-3">
                    <Logo className="h-7 w-auto" />
                    <button
                        onClick={() => navigate('/client')}
                        className="text-2xl"
                    >
                        ←
                    </button>
                    <h1 className="text-xl font-bold">Создать задание</h1>
                </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-4 space-y-4 max-w-full">
                <div>
                    <label className="block text-sm font-medium mb-1">
                        Название задания *
                    </label>
                    <input
                        type="text"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        placeholder="Например: Реклама нового продукта"
                        className="w-full px-4 py-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 focus:border-tg-button outline-none"
                        required
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">
                        Описание *
                    </label>
                    <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Опишите детали задания, что нужно сделать..."
                        rows={5}
                        className="w-full px-4 py-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 focus:border-tg-button outline-none resize-none"
                        required
                    />
                </div>

                {/* Переключатель режима оплаты */}
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={formData.usePricingTiers}
                            onChange={(e) => setFormData({ ...formData, usePricingTiers: e.target.checked })}
                            className="w-5 h-5"
                        />
                        <div>
                            <div className="font-medium">Ценовые диапазоны</div>
                            <div className="text-xs text-tg-hint">
                                Оплата зависит от количества метрик (рекомендуется)
                            </div>
                        </div>
                    </label>
                </div>

                {!formData.usePricingTiers ? (
                    <div>
                        <label className="block text-sm font-medium mb-1">
                            Фиксированный бюджет (сом) *
                        </label>
                        <input
                            type="number"
                            value={formData.budget}
                            onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                            placeholder="10000"
                            min="0"
                            step="100"
                            className="w-full px-4 py-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 focus:border-tg-button outline-none"
                            required
                        />
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="block text-sm font-medium">
                                Ценовые диапазоны *
                            </label>
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={sortPricingTiers}
                                    className="text-tg-button font-medium text-sm"
                                >
                                    ↕ Сортировать
                                </button>
                                <button
                                    type="button"
                                    onClick={addNextPricingTier}
                                    className="text-tg-button font-medium text-sm"
                                >
                                    + Следующий порог
                                </button>
                                <button
                                    type="button"
                                    onClick={addPricingTier}
                                    className="text-tg-button font-medium text-sm"
                                >
                                    + Добавить
                                </button>
                            </div>
                        </div>

                        <div className="text-xs text-tg-hint mb-2">
                            📈 Лесенка: выплата начисляется при достижении "От". Поле "До" можно оставить пустым (∞). Цена может быть 0.
                        </div>

                        {pricingTiers.map((tier, index) => (
                            (() => {
                                const { errors } = normalizePricingTiers(pricingTiers)
                                const rowErrors = errors?.[index] || []
                                return (
                                    <div key={index} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 space-y-2">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm font-medium">Диапазон {index + 1}</span>
                                            {pricingTiers.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => removePricingTier(index)}
                                                    className="text-red-500 text-sm"
                                                >
                                                    Удалить
                                                </button>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="block text-xs text-tg-hint mb-1">От</label>
                                                <input
                                                    type="number"
                                                    value={tier.min}
                                                    onChange={(e) => updatePricingTier(index, 'min', e.target.value)}
                                                    placeholder="2000"
                                                    min="0"
                                                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-sm"
                                                    required={formData.usePricingTiers}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs text-tg-hint mb-1">До</label>
                                                <input
                                                    type="number"
                                                    value={tier.max}
                                                    onChange={(e) => updatePricingTier(index, 'max', e.target.value)}
                                                    placeholder="∞ (необязательно)"
                                                    min="0"
                                                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-sm"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-xs text-tg-hint mb-1">Цена (сом)</label>
                                            <input
                                                type="number"
                                                value={tier.price}
                                                onChange={(e) => updatePricingTier(index, 'price', e.target.value)}
                                                placeholder="2000"
                                                min="0"
                                                step="100"
                                                className="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-sm"
                                                required={formData.usePricingTiers}
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs text-tg-hint mb-1">Метрика</label>
                                            <select
                                                value={tier.metric}
                                                onChange={(e) => updatePricingTier(index, 'metric', e.target.value)}
                                                className="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-sm"
                                            >
                                                <option value="views">👁️ Просмотры</option>
                                                <option value="likes">❤️ Лайки</option>
                                                <option value="comments">💬 Комментарии</option>
                                            </select>
                                        </div>

                                        {rowErrors.length > 0 && (
                                            <div className="text-xs text-red-600 dark:text-red-400 space-y-1">
                                                {rowErrors.map((msg, i) => (
                                                    <div key={i}>• {msg}</div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )
                            })()
                        ))}
                    </div>
                )}

                <div>
                    <label className="block text-sm font-medium mb-1">
                        Минимум подписчиков
                    </label>
                    <input
                        type="number"
                        value={formData.minFollowers}
                        onChange={(e) => setFormData({ ...formData, minFollowers: e.target.value })}
                        placeholder="10000"
                        min="0"
                        step="1"
                        className="w-full px-4 py-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 focus:border-tg-button outline-none"
                    />
                    <p className="text-xs text-tg-hint mt-1">
                        Инфлюенсеры с меньшим количеством подписчиков не смогут откликнуться
                    </p>
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">
                        Минимальная вовлеченность (%)
                    </label>
                    <input
                        type="number"
                        value={formData.minEngagementRate}
                        onChange={(e) => setFormData({ ...formData, minEngagementRate: e.target.value })}
                        placeholder="2.5"
                        min="0"
                        max="100"
                        step="0.1"
                        className="w-full px-4 py-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 focus:border-tg-button outline-none"
                    />
                    <p className="text-xs text-tg-hint mt-1">
                        Engagement Rate — процент взаимодействий (лайки, комментарии) от числа подписчиков
                    </p>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                    <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-3">
                        🎯 Целевые метрики (необязательно)
                    </h3>
                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
                        Укажите желаемые результаты публикации. Система будет автоматически отслеживать прогресс.
                    </p>

                    <div className="space-y-3">
                        <div>
                            <label className="block text-sm font-medium mb-1">
                                Целевое количество просмотров
                            </label>
                            <input
                                type="number"
                                value={formData.targetViews}
                                onChange={(e) => setFormData({ ...formData, targetViews: e.target.value })}
                                placeholder="100000"
                                min="0"
                                className="w-full px-4 py-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 focus:border-tg-button outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">
                                Целевое количество лайков
                            </label>
                            <input
                                type="number"
                                value={formData.targetLikes}
                                onChange={(e) => setFormData({ ...formData, targetLikes: e.target.value })}
                                placeholder="5000"
                                min="0"
                                className="w-full px-4 py-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 focus:border-tg-button outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">
                                Целевое количество комментариев
                            </label>
                            <input
                                type="number"
                                value={formData.targetComments}
                                onChange={(e) => setFormData({ ...formData, targetComments: e.target.value })}
                                placeholder="500"
                                min="0"
                                className="w-full px-4 py-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 focus:border-tg-button outline-none"
                            />
                        </div>
                    </div>
                </div>

                {/* Срок достижения метрик */}
                <div>
                    <label className="block text-sm font-medium mb-1">
                        Срок достижения метрик (дней) *
                    </label>
                    <input
                        type="number"
                        value={formData.metricDeadlineDays}
                        onChange={(e) => setFormData({ ...formData, metricDeadlineDays: e.target.value })}
                        placeholder="7"
                        min="1"
                        max="90"
                        className="w-full px-4 py-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 focus:border-tg-button outline-none"
                        required
                    />
                    <p className="text-xs text-tg-hint mt-1">
                        ⏱️ Инфлюенсер должен достичь целевых метрик за указанное количество дней после одобрения публикации
                    </p>
                </div>

                {/* Максимум инфлюенсеров */}
                <div>
                    <label className="block text-sm font-medium mb-1">
                        Максимальное количество инфлюенсеров
                    </label>
                    <input
                        type="number"
                        value={formData.maxInfluencers}
                        onChange={(e) => setFormData({ ...formData, maxInfluencers: e.target.value })}
                        placeholder="Без ограничений"
                        min="1"
                        className="w-full px-4 py-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 focus:border-tg-button outline-none"
                    />
                    <p className="text-xs text-tg-hint mt-1">
                        👥 Оставьте пустым для неограниченного количества. Один заказ могут брать несколько инфлюенсеров.
                    </p>
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">
                        Дедлайн *
                    </label>
                    <input
                        type="date"
                        value={formData.deadline}
                        onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                        min={new Date().toISOString().split('T')[0]}
                        className="w-full px-4 py-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 focus:border-tg-button outline-none"
                        required
                    />
                    <p className="text-xs text-tg-hint mt-1">
                        📅 Укажите до какой даты должно быть выполнено задание
                    </p>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-brand text-white py-4 rounded-xl font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                    {loading ? 'Создание...' : 'Создать задание'}
                </button>
            </form>
        </div>
    )
}

export default CreateTask
