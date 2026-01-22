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
        category: '',
        minFollowers: '',
        deadline: ''
    })

    const categories = [
        'Красота и уход',
        'Мода',
        'Технологии',
        'Спорт и фитнес',
        'Еда и кулинария',
        'Путешествия',
        'Lifestyle',
        'Другое'
    ]

    const handleSubmit = async (e) => {
        e.preventDefault()

        if (!formData.title || !formData.description || !formData.budget) {
            showAlert?.('Заполните все обязательные поля')
            return
        }

        setLoading(true)
        try {
            const requirements = {}
            if (formData.minFollowers) {
                requirements.minFollowers = parseInt(formData.minFollowers)
            }

            const { data, error } = await supabase
                .from('tasks')
                .insert([
                    {
                        client_id: profile.id,
                        title: formData.title,
                        description: formData.description,
                        budget: parseFloat(formData.budget),
                        category: formData.category || null,
                        requirements: Object.keys(requirements).length > 0 ? requirements : null,
                        deadline: formData.deadline || null,
                        status: 'open'
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
        <div className="min-h-screen pb-6">
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
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
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

                <div>
                    <label className="block text-sm font-medium mb-1">
                        Бюджет (сом) *
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

                <div>
                    <label className="block text-sm font-medium mb-1">
                        Категория
                    </label>
                    <select
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 focus:border-tg-button outline-none"
                    >
                        <option value="">Выберите категорию</option>
                        {categories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>
                </div>

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
