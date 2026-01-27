import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useUserStore } from '../store/userStore'
import { useTelegram } from '../hooks/useTelegram'
import { sendTelegramNotification, formatNewTaskMessage } from '../lib/telegramBot'
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

    const addPricingTier = () => {
        setPricingTiers([...pricingTiers, { min: '', max: '', price: '', metric: 'views' }])
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

        // Проверяем budget только если не используются pricing tiers
        if (!formData.usePricingTiers && !formData.budget) {
            showAlert?.('Укажите бюджет задания')
            return
        }

        // Если используются pricing tiers - проверяем что хотя бы один заполнен
        if (formData.usePricingTiers && pricingTiers.filter(tier => tier.min && tier.max && tier.price).length === 0) {
            showAlert?.('Добавьте хотя бы один ценовой диапазон')
            return
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
                finalPricingTiers = pricingTiers
                    .filter(tier => tier.min && tier.max && tier.price)
                    .map(tier => ({
                        min: parseInt(tier.min),
                        max: parseInt(tier.max),
                        price: parseFloat(tier.price),
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
                await sendTelegramNotification(message)
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
                            <button
                                type="button"
                                onClick={addPricingTier}
                                className="text-tg-button font-medium text-sm"
                            >
                                + Добавить
                            </button>
                        </div>

                        <div className="text-xs text-tg-hint mb-2">
                            📊 Пример: 2,000-10,000 просмотров = 2,000 сом
                        </div>

                        {pricingTiers.map((tier, index) => (
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
                                            placeholder="10000"
                                            min="0"
                                            className="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-sm"
                                            required={formData.usePricingTiers}
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
                            </div>
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
                        Дедлайн
                    </label>
                    <input
                        type="date"
                        value={formData.deadline}
                        onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 focus:border-tg-button outline-none"
                    />
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
