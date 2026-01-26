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
    const [tasks, setTasks] = useState([])
    const [stats, setStats] = useState(null)
    const [withdrawals, setWithdrawals] = useState([])
    const [loading, setLoading] = useState(false)
    const [activeTab, setActiveTab] = useState('users') // users, tasks, stats, withdrawals

    // Проверка прав доступа
    useEffect(() => {
        console.log('AdminPanel - User:', user)
        console.log('User ID:', user?.id, 'Is Admin:', isAdmin(user?.id))

        if (!user || !isAdmin(user.id)) {
            console.log('Admin check failed. User ID:', user?.id, 'Required:', 7737197594)
            showAlert?.('Доступ запрещен. Только для администраторов.')
            navigate('/')
            return
        }

        if (activeTab === 'users') {
            loadUsers()
        } else if (activeTab === 'tasks') {
            loadTasks()
        } else if (activeTab === 'stats') {
            loadStats()
        } else if (activeTab === 'withdrawals') {
            loadWithdrawals()
        }
    }, [user, activeTab])

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

    const loadTasks = async () => {
        console.log('Loading tasks...')
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('tasks')
                .select(`
                    *,
                    client:client_id(id, first_name, last_name, telegram_id),
                    influencer:influencer_id(id, first_name, last_name, telegram_id)
                `)
                .order('created_at', { ascending: false })

            if (error) throw error
            console.log('Tasks loaded:', data)
            setTasks(data || [])
        } catch (error) {
            console.error('Ошибка загрузки заказов:', error)
        } finally {
            setLoading(false)
        }
    }

    const loadStats = async () => {
        console.log('Loading stats...')
        setLoading(true)
        try {
            const { data, error } = await supabase
                .rpc('get_admin_statistics')

            if (error) {
                console.error('Stats RPC error:', error)
                throw error
            }
            console.log('Stats loaded:', data)
            setStats(data)
        } catch (error) {
            console.error('Ошибка загрузки статистики:', error)
            showAlert?.('Функция get_admin_statistics еще не создана в базе данных. Выполните SQL миграцию.')
        } finally {
            setLoading(false)
        }
    }

    const loadWithdrawals = async () => {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('withdrawal_requests')
                .select(`
                    *,
                    users!withdrawal_requests_influencer_id_fkey(
                        first_name,
                        last_name,
                        telegram_id,
                        balance
                    )
                `)
                .order('created_at', { ascending: false })

            if (error) throw error
            setWithdrawals(data || [])
        } catch (error) {
            console.error('Ошибка загрузки заявок:', error)
        } finally {
            setLoading(false)
        }
    }

    const toggleAccountantRole = async (userId, currentRole) => {
        const newRole = currentRole === 'accountant' ? null : 'accountant'

        try {
            const { error } = await supabase
                .from('users')
                .update({ role: newRole })
                .eq('id', userId)

            if (error) throw error

            setUsers(users.map(user =>
                user.id === userId ? { ...user, role: newRole } : user
            ))

            const user = users.find(u => u.id === userId)
            const message = newRole === 'accountant'
                ? `👔 <b>Назначен бухгалтер</b>\n\nПользователь: ${user.first_name} ${user.last_name || ''}\nTelegram ID: <code>${user.telegram_id}</code>`
                : `❌ <b>Снят с роли бухгалтера</b>\n\nПользователь: ${user.first_name} ${user.last_name || ''}`

            await sendAdminNotification(message)
            showAlert?.(newRole === 'accountant' ? 'Пользователь назначен бухгалтером' : 'Роль бухгалтера снята')
        } catch (error) {
            console.error('Ошибка изменения роли:', error)
            showAlert?.('Ошибка при изменении роли')
        }
    }

    const processWithdrawal = async (requestId, status, note = '') => {
        try {
            const { data, error } = await supabase.rpc('process_withdrawal', {
                p_request_id: requestId,
                p_admin_id: user.id,
                p_status: status,
                p_admin_note: note || null
            })

            if (error) throw error

            showAlert?.(status === 'approved' ? 'Выплата одобрена' : 'Заявка отклонена')
            loadWithdrawals()
        } catch (error) {
            console.error('Ошибка обработки заявки:', error)
            showAlert?.('Ошибка: ' + error.message)
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

    // Удалить заказ
    const deleteTask = async (taskId, reason) => {
        if (!reason || reason.trim() === '') {
            showAlert?.('Необходимо указать причину удаления')
            return
        }

        const confirmed = window.confirm('Вы уверены? Если инфлюенсер был оплачен, средства будут возвращены заказчику.')
        if (!confirmed) return

        try {
            const { data, error } = await supabase
                .rpc('admin_delete_task', {
                    p_task_id: taskId,
                    p_admin_reason: reason
                })

            if (error) throw error

            const task = tasks.find(t => t.id === taskId)
            const message = `🗑️ <b>Заказ удален администратором</b>\n\n` +
                `Заказ ID: <code>${taskId}</code>\n` +
                `Заказчик: ${task.client?.first_name} ${task.client?.last_name || ''}\n` +
                (task.influencer ? `Инфлюенсер: ${task.influencer.first_name} ${task.influencer.last_name || ''}\n` : '') +
                `Причина: ${reason}\n` +
                (data.refunded_amount > 0 ? `Возврат заказчику: ${data.refunded_amount.toLocaleString()} сом` : 'Возвратов не было')

            await sendAdminNotification(message)

            // Обновить список заказов
            setTasks(tasks.filter(t => t.id !== taskId))

            showAlert?.(data.refunded_amount > 0
                ? `Заказ удален. Возвращено ${data.refunded_amount} сом заказчику.`
                : 'Заказ успешно удален')
        } catch (error) {
            console.error('Ошибка удаления заказа:', error)
            showAlert?.('Ошибка при удалении заказа')
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
        <div className="min-h-screen pb-20 overflow-x-hidden">
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
                <button
                    onClick={() => setActiveTab('tasks')}
                    className={`px-4 py-2 rounded-full whitespace-nowrap transition-colors ${activeTab === 'tasks'
                        ? 'bg-brand text-white'
                        : 'bg-gray-200 dark:bg-gray-700'
                        }`}
                >
                    📋 Заказы ({tasks.length})
                </button>
                <button
                    onClick={() => setActiveTab('withdrawals')}
                    className={`px-4 py-2 rounded-full whitespace-nowrap transition-colors ${activeTab === 'withdrawals'
                        ? 'bg-brand text-white'
                        : 'bg-gray-200 dark:bg-gray-700'
                        }`}
                >
                    💰 Выплаты ({withdrawals.filter(w => w.status === 'pending').length})
                </button>
                <button
                    onClick={() => setActiveTab('stats')}
                    className={`px-4 py-2 rounded-full whitespace-nowrap transition-colors ${activeTab === 'stats'
                        ? 'bg-brand text-white'
                        : 'bg-gray-200 dark:bg-gray-700'
                        }`}
                >
                    📊 Статистика
                </button>
            </div>

            {/* Content */}
            <div className="p-4">
                {loading ? (
                    <div className="text-center py-10">
                        <div className="text-tg-hint">Загрузка...</div>
                    </div>
                ) : activeTab === 'users' ? (
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
                                        onClick={() => toggleAccountantRole(user.id, user.role)}
                                        className={`text-xs px-3 py-1 rounded-lg ${user.role === 'accountant'
                                            ? 'bg-orange-500 text-white hover:bg-orange-600'
                                            : 'bg-purple-500 text-white hover:bg-purple-600'}`}
                                    >
                                        {user.role === 'accountant' ? '❌ Снять роль бухгалтера' : '👔 Назначить бухгалтером'}
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
                                    {user.role === 'accountant' && <span className="text-orange-600 font-medium mr-2">👔 Бухгалтер</span>}
                                    Создан: {new Date(user.created_at).toLocaleDateString('ru')}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : activeTab === 'tasks' ? (
                    <div className="space-y-3">
                        {tasks.map(task => (
                            <div key={task.id} className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex-1">
                                        <h3 className="font-semibold mb-1 break-words">{task.title}</h3>
                                        <p className="text-sm text-tg-hint mb-2 break-words">{task.description}</p>

                                        <div className="text-sm space-y-1">
                                            <p>
                                                💼 <span className="font-medium">Заказчик:</span>{' '}
                                                {task.client?.first_name} {task.client?.last_name || ''}{' '}
                                                (ID: {task.client?.telegram_id})
                                            </p>
                                            {task.influencer && (
                                                <p>
                                                    📸 <span className="font-medium">Инфлюенсер:</span>{' '}
                                                    {task.influencer.first_name} {task.influencer.last_name || ''}{' '}
                                                    (ID: {task.influencer.telegram_id})
                                                </p>
                                            )}
                                            <p>💰 <span className="font-medium">Бюджет:</span> {task.budget?.toLocaleString()} сом</p>
                                            <p>📅 <span className="font-medium">Создан:</span> {new Date(task.created_at).toLocaleDateString('ru')}</p>
                                        </div>
                                    </div>

                                    <div className="ml-4">
                                        <span className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${task.status === 'open' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                            task.status === 'in_progress' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                                                task.status === 'completed' ? 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200' :
                                                    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                            }`}>
                                            {task.status === 'open' ? '🟢 Открыт' :
                                                task.status === 'in_progress' ? '🔵 В работе' :
                                                    task.status === 'completed' ? '✅ Завершен' :
                                                        task.status}
                                        </span>
                                    </div>
                                </div>

                                <button
                                    onClick={() => {
                                        const reason = prompt('Причина удаления заказа:')
                                        if (reason) deleteTask(task.id, reason)
                                    }}
                                    className="w-full mt-3 px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm font-medium"
                                >
                                    🗑️ Удалить заказ
                                </button>
                            </div>
                        ))}
                        {tasks.length === 0 && (
                            <div className="text-center py-10 text-tg-hint">
                                Заказов пока нет
                            </div>
                        )}
                    </div>
                ) : activeTab === 'withdrawals' ? (
                    <div className="space-y-3">
                        {withdrawals.map(request => (
                            <div key={request.id} className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <p className="font-semibold text-lg">{request.amount.toLocaleString()} сом</p>
                                        <p className="text-sm text-tg-hint">
                                            {request.users?.first_name} {request.users?.last_name || ''}
                                            <span className="text-xs ml-2">({request.users?.telegram_id})</span>
                                        </p>
                                        <p className="text-xs text-tg-hint mt-1">
                                            {new Date(request.created_at).toLocaleDateString('ru-RU', {
                                                day: 'numeric',
                                                month: 'long',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </p>
                                    </div>
                                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${request.status === 'pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200' :
                                        request.status === 'approved' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200' :
                                            request.status === 'rejected' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200' :
                                                'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200'
                                        }`}>
                                        {request.status === 'pending' ? '⏳ На рассмотрении' :
                                            request.status === 'approved' ? '✅ Одобрено' :
                                                request.status === 'rejected' ? '❌ Отклонено' : '💸 Выплачено'}
                                    </span>
                                </div>

                                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 mb-3">
                                    <p className="text-sm font-medium mb-1">
                                        {request.payment_method === 'kaspi' ? '📱 Kaspi Gold' : '💳 Банковская карта'}
                                    </p>
                                    {request.payment_method === 'kaspi' && (
                                        <p className="text-sm text-tg-hint">
                                            Телефон: {request.payment_details.phoneNumber}
                                        </p>
                                    )}
                                    {request.payment_method === 'card' && (
                                        <>
                                            <p className="text-sm text-tg-hint">
                                                Карта: {request.payment_details.cardNumber}
                                            </p>
                                            <p className="text-sm text-tg-hint">
                                                Владелец: {request.payment_details.cardHolder}
                                            </p>
                                        </>
                                    )}
                                    <p className="text-xs text-tg-hint mt-2">
                                        Баланс инфлюенсера: {request.users?.balance?.toLocaleString() || 0} сом
                                    </p>
                                </div>

                                {request.admin_note && (
                                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 mb-3">
                                        <p className="text-xs text-tg-hint mb-1">Комментарий:</p>
                                        <p className="text-sm">{request.admin_note}</p>
                                    </div>
                                )}

                                {request.status === 'pending' && (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => {
                                                const note = prompt('Комментарий (необязательно):')
                                                processWithdrawal(request.id, 'approved', note || '')
                                            }}
                                            className="flex-1 bg-green-500 text-white py-2 rounded-lg hover:bg-green-600 text-sm font-medium"
                                        >
                                            ✅ Одобрить и выплатить
                                        </button>
                                        <button
                                            onClick={() => {
                                                const note = prompt('Причина отклонения:')
                                                if (note) processWithdrawal(request.id, 'rejected', note)
                                            }}
                                            className="flex-1 bg-red-500 text-white py-2 rounded-lg hover:bg-red-600 text-sm font-medium"
                                        >
                                            ❌ Отклонить
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                        {withdrawals.length === 0 && (
                            <div className="text-center py-10 text-tg-hint">
                                Заявок на вывод пока нет
                            </div>
                        )}
                    </div>
                ) : activeTab === 'stats' ? (
                    stats ? (
                        <div className="space-y-4">
                            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md">
                                <h3 className="font-semibold mb-3">👥 Пользователи</h3>
                                <div className="grid grid-cols-3 gap-3 text-center">
                                    <div>
                                        <div className="text-2xl font-bold text-brand">{stats.total_users}</div>
                                        <div className="text-xs text-tg-hint">Всего</div>
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold text-blue-500">{stats.clients}</div>
                                        <div className="text-xs text-tg-hint">Заказчики</div>
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold text-purple-500">{stats.influencers}</div>
                                        <div className="text-xs text-tg-hint">Инфлюенсеры</div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md">
                                <h3 className="font-semibold mb-3">📋 Заказы</h3>
                                <div className="grid grid-cols-3 gap-3 text-center">
                                    <div>
                                        <div className="text-2xl font-bold text-brand">{stats.tasks}</div>
                                        <div className="text-xs text-tg-hint">Всего</div>
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold text-blue-500">{stats.active_tasks}</div>
                                        <div className="text-xs text-tg-hint">Активных</div>
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold text-green-500">{stats.completed_tasks}</div>
                                        <div className="text-xs text-tg-hint">Завершено</div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md">
                                <h3 className="font-semibold mb-3">💰 Финансы</h3>
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-tg-hint">Транзакций:</span>
                                        <span className="font-semibold">{stats.transactions}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-tg-hint">Общий оборот:</span>
                                        <span className="font-semibold">{stats.revenue?.toLocaleString()} сом</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-tg-hint">Баланс на платформе:</span>
                                        <span className="font-semibold text-brand">{stats.platform_balance?.toLocaleString()} сом</span>
                                    </div>
                                </div>
                            </div>

                            {stats.total_posts > 0 && (
                                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md">
                                    <h3 className="font-semibold mb-3">📸 Публикации</h3>
                                    <div className="grid grid-cols-2 gap-3 text-center">
                                        <div>
                                            <div className="text-2xl font-bold text-brand">{stats.total_posts}</div>
                                            <div className="text-xs text-tg-hint">Всего</div>
                                        </div>
                                        <div>
                                            <div className="text-2xl font-bold text-yellow-500">{stats.pending_posts}</div>
                                            <div className="text-xs text-tg-hint">На проверке</div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-center py-10 text-tg-hint">
                            Загрузка статистики...
                        </div>
                    )
                ) : null}
            </div>
        </div>
    )
}

export default AdminPanel