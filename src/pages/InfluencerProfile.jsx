import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useUserStore } from '../store/userStore'
import { useTelegram } from '../hooks/useTelegram'

function InfluencerProfile() {
    const navigate = useNavigate()
    const { showAlert } = useTelegram()
    const { profile } = useUserStore()
    const [loading, setLoading] = useState(false)
    const [influencerProfile, setInfluencerProfile] = useState(null)
    const [formData, setFormData] = useState({
        instagram_username: '',
        followers_count: '',
        category: '',
        description: '',
        price_per_post: ''
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

    useEffect(() => {
        if (profile?.id) {
            loadProfile()
        }
    }, [profile])

    const loadProfile = async () => {
        try {
            const { data, error } = await supabase
                .from('influencer_profiles')
                .select('*')
                .eq('user_id', profile.id)
                .single()

            if (data) {
                setInfluencerProfile(data)
                setFormData({
                    instagram_username: data.instagram_username || '',
                    followers_count: data.followers_count || '',
                    category: data.category || '',
                    description: data.description || '',
                    price_per_post: data.price_per_post || ''
                })
            }
        } catch (error) {
            console.log('Профиль еще не создан')
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()

        if (!formData.instagram_username) {
            showAlert?.('Укажите ваш Instagram username')
            return
        }

        setLoading(true)
        try {
            const profileData = {
                user_id: profile.id,
                instagram_username: formData.instagram_username,
                instagram_url: `https://instagram.com/${formData.instagram_username}`,
                followers_count: parseInt(formData.followers_count) || 0,
                category: formData.category || null,
                description: formData.description || null,
                price_per_post: parseFloat(formData.price_per_post) || null
            }

            let result
            if (influencerProfile) {
                // Обновляем существующий профиль
                result = await supabase
                    .from('influencer_profiles')
                    .update(profileData)
                    .eq('id', influencerProfile.id)
                    .select()
                    .single()
            } else {
                // Создаем новый профиль
                result = await supabase
                    .from('influencer_profiles')
                    .insert([profileData])
                    .select()
                    .single()
            }

            if (result.error) throw result.error

            showAlert?.('Профиль успешно сохранен!')
            navigate('/influencer')
        } catch (error) {
            console.error('Ошибка сохранения профиля:', error)
            showAlert?.('Произошла ошибка. Попробуйте снова.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen pb-6">
            {/* Header */}
            <div className="bg-tg-button text-tg-button-text p-4 pt-8">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/influencer')}
                        className="text-2xl"
                    >
                        ←
                    </button>
                    <h1 className="text-xl font-bold">Мой профиль</h1>
                </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
                <div className="bg-blue-100 dark:bg-blue-900/30 p-4 rounded-xl border border-blue-300 dark:border-blue-700">
                    <p className="text-sm">
                        💡 Заполните информацию о вашем Instagram аккаунте. Это поможет заказчикам принять решение.
                    </p>
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">
                        Instagram username *
                    </label>
                    <div className="flex items-center gap-2">
                        <span className="text-tg-hint">@</span>
                        <input
                            type="text"
                            value={formData.instagram_username}
                            onChange={(e) => setFormData({ ...formData, instagram_username: e.target.value })}
                            placeholder="username"
                            className="flex-1 px-4 py-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 focus:border-tg-button outline-none"
                            required
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">
                        Количество подписчиков
                    </label>
                    <input
                        type="number"
                        value={formData.followers_count}
                        onChange={(e) => setFormData({ ...formData, followers_count: e.target.value })}
                        placeholder="50000"
                        min="0"
                        className="w-full px-4 py-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 focus:border-tg-button outline-none"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">
                        Категория контента
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
                        О себе
                    </label>
                    <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Расскажите о себе и вашем контенте..."
                        rows={4}
                        className="w-full px-4 py-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 focus:border-tg-button outline-none resize-none"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">
                        Цена за пост (сом)
                    </label>
                    <input
                        type="number"
                        value={formData.price_per_post}
                        onChange={(e) => setFormData({ ...formData, price_per_post: e.target.value })}
                        placeholder="5000"
                        min="0"
                        step="100"
                        className="w-full px-4 py-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 focus:border-tg-button outline-none"
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-tg-button text-tg-button-text py-4 rounded-xl font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                    {loading ? 'Сохранение...' : influencerProfile ? 'Обновить профиль' : 'Создать профиль'}
                </button>
            </form>
        </div>
    )
}

export default InfluencerProfile
