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
                navigate(data.user_type === 'client' ? '/client' : '/influencer')
            }
        } catch (error) {
            console.log('Пользователь не найден, показываем выбор типа')
        }
    }

    const handleSelectType = async (type) => {
        if (!user?.id) return

        setLoading(true)
        try {
            // Создаем пользователя в БД
            const { data, error } = await supabase
                .from('users')
                .insert([
                    {
                        telegram_id: user.id,
                        username: user.username,
                        first_name: user.first_name,
                        last_name: user.last_name,
                        user_type: type
                    }
                ])
                .select()
                .single()

            if (error) throw error

            setUserType(type)
            setProfile(data)
            navigate(type === 'client' ? '/client' : '/influencer')
        } catch (error) {
            console.error('Ошибка при создании пользователя:', error)
            alert('Произошла ошибка. Попробуйте снова.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <div className="max-w-md w-full space-y-6">
                <div className="text-center">
                    <h1 className="text-3xl font-bold mb-2">Добро пожаловать!</h1>
                    <p className="text-tg-hint">Выберите тип аккаунта</p>
                </div>

                <div className="space-y-4">
                    <button
                        onClick={() => handleSelectType('client')}
                        disabled={loading}
                        className="w-full p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-xl transition-all border-2 border-transparent hover:border-tg-button disabled:opacity-50"
                    >
                        <div className="text-4xl mb-3">💼</div>
                        <h2 className="text-xl font-semibold mb-2">Я заказчик</h2>
                        <p className="text-tg-hint text-sm">
                            Создавайте задания для инфлюенсеров и получайте результаты
                        </p>
                    </button>

                    <button
                        onClick={() => handleSelectType('influencer')}
                        disabled={loading}
                        className="w-full p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-xl transition-all border-2 border-transparent hover:border-tg-button disabled:opacity-50"
                    >
                        <div className="text-4xl mb-3">📸</div>
                        <h2 className="text-xl font-semibold mb-2">Я инфлюенсер</h2>
                        <p className="text-tg-hint text-sm">
                            Находите заказы от брендов и зарабатывайте на своем контенте
                        </p>
                    </button>
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
