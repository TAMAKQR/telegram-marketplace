import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTelegram } from '../hooks/useTelegram'
import { useUserStore } from '../store/userStore'
import { supabase } from '../lib/supabase'

function UserTypeSelection() {
    const navigate = useNavigate()
    const { user } = useTelegram()
    const { setUserType, setProfile } = useUserStore()
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        // Проверяем, есть ли уже пользователь в БД
        checkExistingUser()
    }, [user])

    const checkExistingUser = async () => {
        if (!user?.id) return

        try {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('telegram_id', user.id)
                .single()

            if (data) {
                setUserType(data.user_type)
                setProfile(data)

                // Если бухгалтер - перенаправляем на его панель
                if (data.role === 'accountant') {
                    navigate('/accountant')
                } else {
                    navigate(data.user_type === 'client' ? '/client' : '/influencer')
                }
            }
        } catch (error) {
            console.log('Пользователь не найден, показываем выбор типа')
        }
    }

    const handleSelectType = async () => {
        if (!user?.id) return

        setLoading(true)
        try {
            // Создаем пользователя в БД как инфлюенсера по умолчанию
            const { data, error } = await supabase
                .from('users')
                .insert([
                    {
                        telegram_id: user.id,
                        username: user.username,
                        first_name: user.first_name,
                        last_name: user.last_name,
                        user_type: 'influencer' // Все по умолчанию инфлюенсеры
                    }
                ])
                .select()
                .single()

            if (error) throw error

            setUserType('influencer')
            setProfile(data)
            navigate('/influencer')
        } catch (error) {
            console.error('Ошибка при создании пользователя:', error)
            alert('Произошла ошибка. Попробуйте снова.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4 pt-8">
            <div className="max-w-md w-full space-y-6">
                <div className="text-center">
                    <h1 className="text-3xl font-bold mb-2">Добро пожаловать!</h1>
                    <p className="text-tg-hint">Присоединяйтесь к нашей платформе инфлюенсеров</p>
                </div>

                <div className="space-y-4">
                    <button
                        onClick={() => handleSelectType()}
                        disabled={loading}
                        className="w-full p-6 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-2xl shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
                    >
                        <div className="text-4xl mb-3">📸</div>
                        <h2 className="text-xl font-semibold mb-2">Стать инфлюенсером</h2>
                        <p className="text-sm opacity-90">
                            Монетизируйте свой Instagram контент и зарабатывайте
                        </p>
                    </button>

                    <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                        <p className="text-sm text-blue-700 dark:text-blue-300">
                            💡 <strong>Хотите стать заказчиком?</strong><br />
                            Обратитесь к администратору для получения статуса
                        </p>
                    </div>
                </div>

                {loading && (
                    <div className="text-center text-tg-hint">
                        Создание профиля...
                    </div>
                )}
            </div>
        </div>
    )
}

export default UserTypeSelection
