import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useUserStore } from '../store/userStore'
import { useTelegram } from '../hooks/useTelegram'
import { isAdmin } from '../lib/telegramBot'
import Logo from '../components/Logo'

function ClientDashboard() {
    const navigate = useNavigate()
    const { user } = useTelegram()
    const { profile } = useUserStore()
    const [tasks, setTasks] = useState([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState('all') // all, open, in_progress, completed, admin
    const [allUsers, setAllUsers] = useState([])
    const [usersLoading, setUsersLoading] = useState(false)
    const [balanceAmount, setBalanceAmount] = useState('')
    const [selectedUserId, setSelectedUserId] = useState('')
    const [notificationTest, setNotificationTest] = useState(null)

    useEffect(() => {
        if (profile?.id) {
            loadTasks()
        }
    }, [profile, activeTab])

    useEffect(() => {
        if (activeTab === 'admin' && user && isAdmin(user.id)) {
            loadAllUsers()
        }
    }, [activeTab, user])

    const loadTasks = async () => {
        try {
            let query = supabase
                .from('tasks')
                .select('*, task_applications(count)')
                .eq('client_id', profile.id)
                .order('created_at', { ascending: false })

            if (activeTab !== 'all') {
                query = query.eq('status', activeTab)
            }

            const { data, error } = await query

            if (error) throw error
            setTasks(data || [])
        } catch (error) {
            console.error('Ошибка загрузки заданий:', error)
        } finally {
            setLoading(false)
        }
    }

    const loadAllUsers = async () => {
        setUsersLoading(true)
        try {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .order('created_at', { ascending: false })

            if (error) throw error
            setAllUsers(data || [])
        } catch (error) {
            console.error('Ошибка загрузки пользователей:', error)
        } finally {
            setUsersLoading(false)
        }
    }

    const toggleUserType = async (userId, currentType) => {
        const newType = currentType === 'client' ? 'influencer' : 'client'
        try {
            const { error } = await supabase
                .from('users')
                .update({ user_type: newType })
                .eq('id', userId)

            if (error) throw error
            await loadAllUsers()
            alert(`Тип пользователя изменен на ${newType === 'client' ? 'Заказчик' : 'Инфлюенсер'}`)
        } catch (error) {
            console.error('Ошибка изменения типа:', error)
            alert('Ошибка изменения типа пользователя')
        }
    }

    const toggleUserBlock = async (userId, currentBlocked) => {
        try {
            const { error } = await supabase
                .from('users')
                .update({ is_blocked: !currentBlocked })
                .eq('id', userId)

            if (error) throw error
            await loadAllUsers()
            alert(`Пользователь ${!currentBlocked ? 'заблокирован' : 'разблокирован'}`)
        } catch (error) {
            console.error('Ошибка блокировки:', error)
            alert('Ошибка изменения статуса блокировки')
        }
    }

    const deleteUser = async (userId, userName) => {
        const confirmed = window.confirm(`Вы уверены, что хотите удалить пользователя ${userName}? Это действие необратимо!`)

        if (!confirmed) return

        try {
            const { error } = await supabase
                .from('users')
                .delete()
                .eq('id', userId)

            if (error) throw error
            await loadAllUsers()
            alert('Пользователь успешно удален')
        } catch (error) {
            console.error('Ошибка удаления:', error)
            alert('Ошибка удаления пользователя: ' + error.message)
        }
    }

    const addBalance = async () => {
        if (!selectedUserId || !balanceAmount) {
            alert('Выберите пользователя и введите сумму')
            return
        }

        const amount = parseFloat(balanceAmount)
        if (isNaN(amount) || amount <= 0) {
            alert('Введите корректную сумму')
            return
        }

        try {
            const { error } = await supabase.rpc('increment_balance', {
                user_id: selectedUserId,
                amount: amount
            })

            if (error) throw error
            await loadAllUsers()
            setBalanceAmount('')
            setSelectedUserId('')
            alert(`Баланс пополнен на ${amount} сом`)
        } catch (error) {
            console.error('Ошибка пополнения:', error)
            alert('Ошибка пополнения баланса')
        }
    }

    const getStatusText = (status) => {
        const statusMap = {
            open: '🟢 Открыто',
            in_progress: '🟡 В работе',
            completed: '✅ Завершено',
            cancelled: '❌ Отменено'
        }
        return statusMap[status] || status
    }

    return (
        <div className="min-h-screen pb-20 overflow-x-hidden">
            {/* Header */}
            <div className="bg-brand-gradient text-white pt-8" style={{ padding: 'var(--spacing-xl) var(--spacing-lg)' }}>
                <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                        <Logo className="h-8 w-auto" />
                        <div>
                            <h1 className="text-2xl">Мои задания</h1>
                            <p className="text-sm opacity-90">Привет, {user?.first_name}! 👋</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        {user && isAdmin(user.id) && (
                            <button
                                onClick={() => setActiveTab('admin')}
                                className="bg-red-500/20 px-3 py-1 rounded-lg text-xs text-red-200 hover:bg-red-500/30"
                            >
                                🔧 Админ
                            </button>
                        )}
                        <button
                            onClick={() => navigate('/balance')}
                            className="bg-white/20 px-3 py-1 rounded-lg text-xs font-medium hover:bg-white/30 transition-colors"
                        >
                            👤 Профиль
                        </button>
                    </div>
                </div>

                {/* Balance */}
                <div className="mt-4 bg-white/10 backdrop-blur-sm rounded-xl p-4 flex justify-between items-center">
                    <div>
                        <div className="text-xs opacity-75">Баланс</div>
                        <div className="text-xl font-bold">{(profile?.balance || 0).toLocaleString()} сом</div>
                    </div>
                    <button
                        onClick={() => navigate('/balance')}
                        className="btn-mobile px-6 py-2 bg-white/20 rounded-lg font-medium hover:bg-white/30 transition-colors"
                    >
                        Пополнить
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 overflow-x-auto" style={{ padding: 'var(--spacing-md)' }}>
                {[
                    { key: 'all', label: 'Все' },
                    { key: 'open', label: 'Открытые' },
                    { key: 'in_progress', label: 'В работе' },
                    { key: 'completed', label: 'Завершенные' }
                ].map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`px-4 py-2 rounded-full whitespace-nowrap transition-colors ${activeTab === tab.key
                            ? 'bg-brand text-white'
                            : 'bg-gray-200 dark:bg-gray-700'
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
                {user && isAdmin(user.id) && (
                    <button
                        onClick={() => navigate('/admin')}
                        className="px-4 py-2 rounded-full whitespace-nowrap transition-colors bg-red-500 text-white hover:bg-red-600"
                    >
                        🔧 Админ-панель
                    </button>
                )}
            </div>

            {/* Tasks List */}
            <div style={{ padding: 'var(--spacing-md)', gap: 'var(--spacing-sm)' }} className="flex flex-col">
                {activeTab === 'admin' && user && isAdmin(user.id) ? (
                    <div className="space-y-4">
                        {/* Пополнение баланса */}
                        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md">
                            <h3 className="font-semibold text-lg mb-4">💰 Пополнение баланса</h3>
                            <div className="space-y-3">
                                <select
                                    value={selectedUserId}
                                    onChange={(e) => setSelectedUserId(e.target.value)}
                                    className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700"
                                >
                                    <option value="">Выберите пользователя</option>
                                    {allUsers.map(user => (
                                        <option key={user.id} value={user.id}>
                                            {user.first_name} {user.last_name} (Баланс: {user.balance || 0} сом)
                                        </option>
                                    ))}
                                </select>
                                <input
                                    type="number"
                                    placeholder="Сумма пополнения"
                                    value={balanceAmount}
                                    onChange={(e) => setBalanceAmount(e.target.value)}
                                    className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700"
                                />
                                <button
                                    onClick={addBalance}
                                    className="w-full bg-green-500 hover:bg-green-600 text-white font-medium py-3 px-4 rounded-lg transition-colors"
                                >
                                    Пополнить баланс
                                </button>
                            </div>
                        </div>

                        {/* Список пользователей */}
                        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-semibold text-lg">👥 Все пользователи</h3>
                                <button
                                    onClick={loadAllUsers}
                                    className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm"
                                >
                                    🔄 Обновить
                                </button>
                            </div>

                            {usersLoading ? (
                                <div className="text-center py-4">Загрузка...</div>
                            ) : (
                                <div className="space-y-2 max-h-96 overflow-y-auto">
                                    {allUsers.map(user => (
                                        <div key={user.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-3">
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <div className="font-medium">
                                                        {user.first_name} {user.last_name}
                                                    </div>
                                                    <div className="text-sm text-gray-500">
                                                        ID: {user.id} | Баланс: {user.balance || 0} сом
                                                    </div>
                                                    <div className="flex gap-2 mt-1">
                                                        <span className={`text-xs px-2 py-1 rounded ${user.user_type === 'client'
                                                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                                            : 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                                                            }`}>
                                                            {user.user_type === 'client' ? '👔 Заказчик' : '📱 Инфлюенсер'}
                                                        </span>
                                                        {user.is_blocked && (
                                                            <span className="text-xs px-2 py-1 rounded bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                                                                🚫 Заблокирован
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex gap-1">
                                                    <button
                                                        onClick={() => toggleUserType(user.id, user.user_type)}
                                                        className="text-xs bg-gray-100 hover:bg-gray-200 dark:bg-gray-600 dark:hover:bg-gray-500 px-2 py-1 rounded transition-colors"
                                                        title="Изменить тип пользователя"
                                                    >
                                                        🔄
                                                    </button>
                                                    <button
                                                        onClick={() => toggleUserBlock(user.id, user.is_blocked)}
                                                        className={`text-xs px-2 py-1 rounded transition-colors ${user.is_blocked
                                                            ? 'bg-green-100 hover:bg-green-200 text-green-800 dark:bg-green-900 dark:text-green-200'
                                                            : 'bg-red-100 hover:bg-red-200 text-red-800 dark:bg-red-900 dark:text-red-200'
                                                            }`}
                                                        title={user.is_blocked ? 'Разблокировать' : 'Заблокировать'}
                                                    >
                                                        {user.is_blocked ? '✅' : '🚫'}
                                                    </button>
                                                    <button
                                                        onClick={() => deleteUser(user.id, `${user.first_name} ${user.last_name}`)}
                                                        className="text-xs bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded transition-colors"
                                                        title="Удалить пользователя"
                                                    >
                                                        🗑️
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ) : loading ? (
                    <div className="text-center py-10">
                        <div className="text-tg-hint">Загрузка...</div>
                    </div>
                ) : tasks.length === 0 ? (
                    <div className="text-center py-10">
                        <div className="text-4xl mb-4">📝</div>
                        <p className="text-tg-hint mb-4">
                            {activeTab === 'all'
                                ? 'У вас пока нет заданий'
                                : `Нет заданий со статусом "${activeTab}"`
                            }
                        </p>
                        {activeTab === 'all' && (
                            <button
                                onClick={() => navigate('/client/create-task')}
                                className="bg-brand text-white px-6 py-3 rounded-xl font-semibold"
                            >
                                Создать первое задание
                            </button>
                        )}
                    </div>
                ) : (
                    tasks.map(task => (
                        <div
                            key={task.id}
                            onClick={() => navigate(`/client/task/${task.id}`)}
                            className="task-card bg-white dark:bg-gray-800 rounded-xl shadow-md hover:shadow-lg transition-shadow cursor-pointer"
                        >
                            <div className="flex justify-between items-start" style={{ marginBottom: 'var(--spacing-xs)' }}>
                                <h3 className="task-title flex-1 break-words">{task.title}</h3>
                                <span className="text-xs ml-2">{getStatusText(task.status)}</span>
                            </div>
                            <p className="task-description line-clamp-2 break-words">
                                {task.description}
                            </p>
                            <div className="flex justify-between items-center">
                                <span className="task-price">
                                    {task.budget} сом
                                </span>
                                <span className="text-xs text-tg-hint">
                                    {task.task_applications?.[0]?.count || 0} откликов
                                </span>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Create Button */}
            <button
                onClick={() => navigate('/client/create-task')}
                className="fixed bottom-6 right-6 bg-brand text-white w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-2xl hover:scale-110 transition-transform"
            >
                +
            </button>
        </div>
    )
}

export default ClientDashboard
