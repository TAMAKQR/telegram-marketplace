import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useTelegram } from '../hooks/useTelegram'
import { isAdmin, sendAdminNotification } from '../lib/telegramBot'
import Logo from '../components/Logo'

function AdminPanel() {
    const navigate = useNavigate()
    const { user, showAlert } = useTelegram()
    const [users, setUsers] = useState([])
    const [loading, setLoading] = useState(false)
    const [activeTab, setActiveTab] = useState('users') // users, balance, payments

    // Проверка прав доступа
    useEffect(() => {
        if (!user || !isAdmin(user.id)) {
            showAlert?.('Доступ запрещен. Только для администраторов.')
            navigate('/')
            return
        }
        loadUsers()
    }, [user])

    const loadUsers = async () => {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .order('created_at', { ascending: false })

            if (error) throw error
            setUsers(data || [])
        } catch (error) {
            console.error('Ошибка загрузки пользователей:', error)
        } finally {
            setLoading(false)
        }
    }

    // Назначить/снять статус заказчика
    const toggleUserType = async (userId, currentType) => {
        const newType = currentType === 'client' ? 'influencer' : 'client'

        try {
            const { error } = await supabase
                .from('users')
                .update({ user_type: newType })
                .eq('id', userId)

            if (error) throw error

            setUsers(users.map(user =>
                user.id === userId ? { ...user, user_type: newType } : user
            ))

            const user = users.find(u => u.id === userId)
            const message = `👤 <b>Изменен статус пользователя</b>\n\n` +
                `Пользователь: ${user.first_name} ${user.last_name || ''}\n` +
                `Telegram ID: <code>${user.telegram_id}</code>\n` +
                `Новый статус: ${newType === 'client' ? '💼 Заказчик' : '📸 Инфлюенсер'}`

            await sendAdminNotification(message)
            showAlert?.(`Статус изменен на ${newType === 'client' ? 'Заказчик' : 'Инфлюенсер'}`)
        } catch (error) {
            console.error('Ошибка изменения статуса:', error)
            showAlert?.('Ошибка при изменении статуса')
        }
    }

    // Пополнить баланс пользователя
    const addBalance = async (userId, amount) => {
        const amountValue = parseFloat(amount)
        if (!amountValue || amountValue <= 0) {
            showAlert?.('Введите корректную сумму')
            return
        }

        try {
            const user = users.find(u => u.id === userId)
            const newBalance = (user.balance || 0) + amountValue

            const { error: updateError } = await supabase
                .from('users')
                .update({ balance: newBalance })
                .eq('id', userId)

            if (updateError) throw updateError

            // Создать транзакцию
            const { error: transactionError } = await supabase
                .from('transactions')
                .insert({
                    to_user_id: userId,
                    amount: amountValue,
                    type: 'deposit',
                    status: 'completed',
                    description: 'Пополнение админом'
                })

            if (transactionError) throw transactionError

            setUsers(users.map(u =>
                u.id === userId ? { ...u, balance: newBalance } : u
            ))

            const message = `💰 <b>Пополнение баланса</b>\n\n` +
                `Пользователь: ${user.first_name} ${user.last_name || ''}\n` +
                `Telegram ID: <code>${user.telegram_id}</code>\n` +
                `Сумма: +${amountValue.toLocaleString()} сом\n` +
                `Новый баланс: ${newBalance.toLocaleString()} сом`

            await sendAdminNotification(message)
            showAlert?.(`Баланс пополнен на ${amountValue} сом`)
        } catch (error) {
            console.error('Ошибка пополнения баланса:', error)
            showAlert?.('Ошибка при пополнении баланса')
        }
    }

    if (!user || !isAdmin(user.id)) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <h2 className="text-xl font-semibold mb-2">Доступ запрещен</h2>
                    <p className="text-tg-hint">Только для администраторов</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen pb-20">
            {/* Header */}
            <div className="bg-brand-gradient text-white p-4 pt-8">
                <div className="flex items-center gap-3 mb-2">
                    <Logo className="h-7 w-auto" />
                    <button onClick={() => navigate('/')} className="text-2xl">←</button>
                    <h1 className="text-2xl font-bold">🔧 Админ-панель</h1>
                </div>
                <p className="text-sm opacity-90">Управление пользователями и балансами</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 p-4 overflow-x-auto">
                <button
                    onClick={() => setActiveTab('users')}
                    className={`px-4 py-2 rounded-full whitespace-nowrap transition-colors ${activeTab === 'users'
                        ? 'bg-brand text-white'
                        : 'bg-gray-200 dark:bg-gray-700'
                        }`}
                >
                    👥 Пользователи ({users.length})
                </button>
            </div>

            {/* Content */}
            <div className="p-4">
                {loading ? (
                    <div className="text-center py-10">
                        <div className="text-tg-hint">Загрузка...</div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {users.map(user => (
                            <div key={user.id} className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <h3 className="font-semibold">
                                            {user.first_name} {user.last_name || ''}
                                        </h3>
                                        <p className="text-sm text-tg-hint">
                                            @{user.username || 'без username'} • ID: {user.telegram_id}
                                        </p>
                                        <p className="text-sm">
                                            💰 Баланс: <span className="font-semibold">{user.balance?.toLocaleString() || 0} сом</span>
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <span className={`text-xs px-2 py-1 rounded-full ${user.user_type === 'client'
                                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                            : 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                                            }`}>
                                            {user.user_type === 'client' ? '💼 Заказчик' : '📸 Инфлюенсер'}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex gap-2 flex-wrap">
                                    <button
                                        onClick={() => toggleUserType(user.id, user.user_type)}
                                        className="text-xs px-3 py-1 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                                    >
                                        {user.user_type === 'client' ? 'Сделать инфлюенсером' : 'Сделать заказчиком'}
                                    </button>

                                    <button
                                        onClick={() => {
                                            const amount = prompt('Сумма пополнения (сом):')
                                            if (amount) addBalance(user.id, amount)
                                        }}
                                        className="text-xs px-3 py-1 bg-green-500 text-white rounded-lg hover:bg-green-600"
                                    >
                                        💰 Пополнить баланс
                                    </button>
                                </div>

                                <div className="mt-2 text-xs text-tg-hint">
                                    Создан: {new Date(user.created_at).toLocaleDateString('ru')}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

export default AdminPanel