import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Logo from '../components/Logo'
import { formatTaskBudget } from '../lib/taskBudget'

// Учётные данные для веб-доступа
const WEB_ADMIN_LOGIN = 'Daison'
const WEB_ADMIN_PASSWORD = 'Production'

function WebAdminSettings() {
    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [login, setLogin] = useState('')
    const [password, setPassword] = useState('')
    const [authError, setAuthError] = useState('')

    const [loading, setLoading] = useState(false)
    const [activeTab, setActiveTab] = useState('settings') // settings, users, tasks, withdrawals, stats

    // Данные
    const [settings, setSettings] = useState({})
    const [users, setUsers] = useState([])
    const [tasks, setTasks] = useState([])
    const [withdrawals, setWithdrawals] = useState([])
    const [stats, setStats] = useState(null)
    const [saveStatus, setSaveStatus] = useState('')

    // Проверяем сохранённую сессию
    useEffect(() => {
        const savedAuth = sessionStorage.getItem('webAdminAuth')
        if (savedAuth === 'true') {
            setIsAuthenticated(true)
        }
    }, [])

    // Загрузка данных при смене вкладки
    useEffect(() => {
        if (!isAuthenticated) return

        if (activeTab === 'settings') loadSettings()
        else if (activeTab === 'users') loadUsers()
        else if (activeTab === 'tasks') loadTasks()
        else if (activeTab === 'withdrawals') loadWithdrawals()
        else if (activeTab === 'stats') loadStats()
    }, [isAuthenticated, activeTab])

    const handleLogin = (e) => {
        e.preventDefault()
        if (login === WEB_ADMIN_LOGIN && password === WEB_ADMIN_PASSWORD) {
            setIsAuthenticated(true)
            sessionStorage.setItem('webAdminAuth', 'true')
            setAuthError('')
        } else {
            setAuthError('Неверный логин или пароль')
        }
    }

    const handleLogout = () => {
        setIsAuthenticated(false)
        sessionStorage.removeItem('webAdminAuth')
        setLogin('')
        setPassword('')
    }

    // === Загрузка данных ===
    const loadSettings = async () => {
        setLoading(true)
        try {
            const { data, error } = await supabase.from('app_settings').select('*')
            if (error) throw error
            const settingsObj = {}
            data?.forEach(row => {
                settingsObj[row.key] = { value: row.value, description: row.description, updated_at: row.updated_at }
            })
            setSettings(settingsObj)
        } catch (error) {
            console.error('Ошибка загрузки настроек:', error)
        } finally {
            setLoading(false)
        }
    }

    const loadUsers = async () => {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('is_deleted', false)
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
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('tasks')
                .select(`*, client:client_id(id, first_name, last_name, telegram_id)`)
                .order('created_at', { ascending: false })
            if (error) throw error
            setTasks(data || [])
        } catch (error) {
            console.error('Ошибка загрузки заказов:', error)
        } finally {
            setLoading(false)
        }
    }

    const loadWithdrawals = async () => {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('withdrawal_requests')
                .select(`*, users!withdrawal_requests_influencer_id_fkey(first_name, last_name, telegram_id, balance)`)
                .order('created_at', { ascending: false })
            if (error) throw error
            setWithdrawals(data || [])
        } catch (error) {
            console.error('Ошибка загрузки выплат:', error)
        } finally {
            setLoading(false)
        }
    }

    const loadStats = async () => {
        setLoading(true)
        try {
            const { data, error } = await supabase.rpc('get_admin_statistics')
            if (error) throw error
            setStats(data)
        } catch (error) {
            console.error('Ошибка загрузки статистики:', error)
        } finally {
            setLoading(false)
        }
    }

    // === Действия ===
    const toggleMetricsMode = async () => {
        const currentMode = settings.instagram_metrics_mode?.value || 'auto'
        const newMode = currentMode === 'auto' ? 'manual' : 'auto'
        try {
            setSaveStatus('Сохранение...')
            const { error } = await supabase.rpc('set_app_setting', {
                p_key: 'instagram_metrics_mode',
                p_value: JSON.stringify(newMode),
                p_admin_telegram_id: null
            })
            if (error) throw error
            setSettings({
                ...settings,
                instagram_metrics_mode: { ...settings.instagram_metrics_mode, value: newMode, updated_at: new Date().toISOString() }
            })
            setSaveStatus(`✅ Режим изменён на: ${newMode === 'auto' ? 'Автоматический' : 'Ручной'}`)
            setTimeout(() => setSaveStatus(''), 3000)
        } catch (error) {
            console.error('Ошибка:', error)
            setSaveStatus('❌ Ошибка сохранения')
        }
    }

    const toggleUserType = async (userId, currentType) => {
        const newType = currentType === 'client' ? 'influencer' : 'client'
        try {
            const { error } = await supabase.from('users').update({ user_type: newType }).eq('id', userId)
            if (error) throw error
            setUsers(users.map(u => u.id === userId ? { ...u, user_type: newType } : u))
            alert(`Статус изменен на ${newType === 'client' ? 'Заказчик' : 'Инфлюенсер'}`)
        } catch (error) {
            console.error('Ошибка:', error)
            alert('Ошибка при изменении статуса')
        }
    }

    const addBalance = async (userId) => {
        const amount = prompt('Сумма пополнения (сом):')
        if (!amount) return
        const amountValue = parseFloat(amount)
        if (!amountValue || amountValue <= 0) {
            alert('Введите корректную сумму')
            return
        }
        try {
            const user = users.find(u => u.id === userId)
            const newBalance = (user.balance || 0) + amountValue
            const { error } = await supabase.from('users').update({ balance: newBalance }).eq('id', userId)
            if (error) throw error
            await supabase.from('transactions').insert({
                to_user_id: userId, amount: amountValue, type: 'deposit', status: 'completed', description: 'Пополнение админом (веб)'
            })
            setUsers(users.map(u => u.id === userId ? { ...u, balance: newBalance } : u))
            alert(`Баланс пополнен на ${amountValue} сом`)
        } catch (error) {
            console.error('Ошибка:', error)
            alert('Ошибка при пополнении баланса')
        }
    }

    const processWithdrawal = async (requestId, status) => {
        const note = status === 'rejected' ? prompt('Причина отклонения:') : ''
        if (status === 'rejected' && !note) return
        try {
            const { error } = await supabase.rpc('process_withdrawal', {
                p_request_id: requestId,
                p_admin_id: null,
                p_status: status,
                p_admin_note: note || null
            })
            if (error) throw error
            alert(status === 'approved' ? 'Выплата одобрена' : 'Заявка отклонена')
            loadWithdrawals()
        } catch (error) {
            console.error('Ошибка:', error)
            alert('Ошибка: ' + error.message)
        }
    }

    // Форма авторизации
    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
                    <div className="text-center mb-8">
                        <Logo className="h-12 mx-auto mb-4" />
                        <h1 className="text-2xl font-bold text-gray-800">🔐 Админ-панель</h1>
                        <p className="text-gray-500 mt-2">Полное управление платформой</p>
                    </div>
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Логин</label>
                            <input type="text" value={login} onChange={(e) => setLogin(e.target.value)}
                                className="w-full p-3 border border-gray-300 rounded-lg" placeholder="Введите логин" required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Пароль</label>
                            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                                className="w-full p-3 border border-gray-300 rounded-lg" placeholder="Введите пароль" required />
                        </div>
                        {authError && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{authError}</div>}
                        <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700">Войти</button>
                    </form>
                </div>
            </div>
        )
    }

    // Панель админа
    return (
        <div className="min-h-screen bg-gray-100">
            {/* Header */}
            <header className="bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg">
                <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Logo className="h-8" />
                        <h1 className="text-xl font-bold">🔧 Админ-панель</h1>
                    </div>
                    <button onClick={handleLogout} className="text-white/80 hover:text-white px-4 py-2 rounded-lg hover:bg-white/10">
                        Выйти
                    </button>
                </div>
            </header>

            {/* Tabs */}
            <div className="bg-white shadow-sm">
                <div className="max-w-6xl mx-auto px-4">
                    <div className="flex gap-1 overflow-x-auto py-2">
                        {[
                            { id: 'settings', label: '⚙️ Настройки' },
                            { id: 'users', label: `👥 Пользователи (${users.length})` },
                            { id: 'tasks', label: `📋 Заказы (${tasks.length})` },
                            { id: 'withdrawals', label: `💰 Выплаты (${withdrawals.filter(w => w.status === 'pending').length})` },
                            { id: 'stats', label: '📊 Статистика' },
                        ].map(tab => (
                            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                                className={`px-4 py-2 rounded-lg whitespace-nowrap font-medium transition-colors ${activeTab === tab.id ? 'bg-purple-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                                    }`}>
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Content */}
            <main className="max-w-6xl mx-auto p-4 mt-4">
                {loading ? (
                    <div className="text-center py-20 text-gray-500">Загрузка...</div>
                ) : activeTab === 'settings' ? (
                    // === Настройки ===
                    <div className="space-y-6">
                        <div className="bg-white rounded-xl shadow-sm p-6">
                            <h2 className="text-lg font-semibold mb-4">📸 Instagram метрики</h2>
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                                <p className="text-sm text-yellow-800">
                                    <strong>⚠️ Instagram API на проверке</strong><br />
                                    Если автоматический сбор не работает, включите ручной режим.
                                </p>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                                <div>
                                    <p className="font-medium">Режим сбора метрик</p>
                                    <p className="text-sm text-gray-500">
                                        {settings.instagram_metrics_mode?.value === 'manual' ? '✍️ Ручной' : '🤖 Автоматический'}
                                    </p>
                                </div>
                                <button onClick={toggleMetricsMode}
                                    className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors ${settings.instagram_metrics_mode?.value === 'manual' ? 'bg-orange-500' : 'bg-green-500'
                                        }`}>
                                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${settings.instagram_metrics_mode?.value === 'manual' ? 'translate-x-8' : 'translate-x-1'
                                        }`} />
                                </button>
                            </div>
                            {saveStatus && <div className="mt-4 text-center text-sm font-medium">{saveStatus}</div>}
                        </div>
                    </div>
                ) : activeTab === 'users' ? (
                    // === Пользователи ===
                    <div className="space-y-3">
                        {users.map(user => (
                            <div key={user.id} className="bg-white rounded-xl p-4 shadow-sm">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <h3 className="font-semibold">{user.first_name} {user.last_name || ''}</h3>
                                        <p className="text-sm text-gray-500">@{user.username || 'без username'} • ID: {user.telegram_id}</p>
                                        <p className="text-sm">💰 Баланс: <strong>{user.balance?.toLocaleString() || 0} сом</strong></p>
                                    </div>
                                    <span className={`text-xs px-2 py-1 rounded-full ${user.user_type === 'client' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                                        }`}>
                                        {user.user_type === 'client' ? '💼 Заказчик' : '📸 Инфлюенсер'}
                                    </span>
                                </div>
                                <div className="flex gap-2 flex-wrap">
                                    <button onClick={() => toggleUserType(user.id, user.user_type)}
                                        className="text-xs px-3 py-1 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
                                        {user.user_type === 'client' ? 'Сделать инфлюенсером' : 'Сделать заказчиком'}
                                    </button>
                                    <button onClick={() => addBalance(user.id)}
                                        className="text-xs px-3 py-1 bg-green-500 text-white rounded-lg hover:bg-green-600">
                                        💰 Пополнить
                                    </button>
                                </div>
                                <p className="text-xs text-gray-400 mt-2">
                                    {user.role === 'accountant' && <span className="text-orange-600 font-medium mr-2">👔 Бухгалтер</span>}
                                    Создан: {new Date(user.created_at).toLocaleDateString('ru')}
                                </p>
                            </div>
                        ))}
                        {users.length === 0 && <p className="text-center py-10 text-gray-500">Нет пользователей</p>}
                    </div>
                ) : activeTab === 'tasks' ? (
                    // === Заказы ===
                    <div className="space-y-3">
                        {tasks.map(task => (
                            <div key={task.id} className="bg-white rounded-xl p-4 shadow-sm">
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <h3 className="font-semibold mb-1">{task.title}</h3>
                                        <p className="text-sm text-gray-500 mb-2">{task.description?.slice(0, 100)}...</p>
                                        <p className="text-sm">💼 Заказчик: {task.client?.first_name} {task.client?.last_name || ''}</p>
                                        <p className="text-sm">💰 Бюджет: {formatTaskBudget(task, { prefix: '' })}</p>
                                    </div>
                                    <span className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${task.status === 'open' ? 'bg-green-100 text-green-800' :
                                            task.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                                                task.status === 'completed' ? 'bg-gray-100 text-gray-800' : 'bg-red-100 text-red-800'
                                        }`}>
                                        {task.status === 'open' ? '🟢 Открыт' :
                                            task.status === 'in_progress' ? '🔵 В работе' :
                                                task.status === 'completed' ? '✅ Завершен' : '❌ Отменен'}
                                    </span>
                                </div>
                                <p className="text-xs text-gray-400 mt-2">
                                    Создан: {new Date(task.created_at).toLocaleDateString('ru')}
                                </p>
                            </div>
                        ))}
                        {tasks.length === 0 && <p className="text-center py-10 text-gray-500">Нет заказов</p>}
                    </div>
                ) : activeTab === 'withdrawals' ? (
                    // === Выплаты ===
                    <div className="space-y-3">
                        {withdrawals.map(request => (
                            <div key={request.id} className="bg-white rounded-xl p-4 shadow-sm">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <h3 className="font-semibold">{request.users?.first_name} {request.users?.last_name || ''}</h3>
                                        <p className="text-sm text-gray-500">Telegram: {request.users?.telegram_id}</p>
                                        <p className="text-sm">💰 Баланс: {request.users?.balance?.toLocaleString()} сом</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xl font-bold text-green-600">{request.amount?.toLocaleString()} сом</p>
                                        <span className={`text-xs px-2 py-1 rounded-full ${request.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                                request.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                            }`}>
                                            {request.status === 'pending' ? '⏳ Ожидает' :
                                                request.status === 'approved' ? '✅ Одобрено' : '❌ Отклонено'}
                                        </span>
                                    </div>
                                </div>
                                <p className="text-sm text-gray-600 mb-3">
                                    📱 {request.payment_method}: <strong>{request.payment_details}</strong>
                                </p>
                                {request.status === 'pending' && (
                                    <div className="flex gap-2">
                                        <button onClick={() => processWithdrawal(request.id, 'approved')}
                                            className="flex-1 bg-green-500 text-white py-2 rounded-lg hover:bg-green-600 font-medium">
                                            ✅ Одобрить
                                        </button>
                                        <button onClick={() => processWithdrawal(request.id, 'rejected')}
                                            className="flex-1 bg-red-500 text-white py-2 rounded-lg hover:bg-red-600 font-medium">
                                            ❌ Отклонить
                                        </button>
                                    </div>
                                )}
                                <p className="text-xs text-gray-400 mt-2">
                                    Создано: {new Date(request.created_at).toLocaleString('ru')}
                                </p>
                            </div>
                        ))}
                        {withdrawals.length === 0 && <p className="text-center py-10 text-gray-500">Нет заявок на выплату</p>}
                    </div>
                ) : activeTab === 'stats' ? (
                    // === Статистика ===
                    stats ? (
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div className="bg-white rounded-xl p-6 shadow-sm">
                                <h3 className="font-semibold mb-3">👥 Пользователи</h3>
                                <div className="grid grid-cols-3 gap-3 text-center">
                                    <div>
                                        <div className="text-2xl font-bold text-purple-600">{stats.total_users}</div>
                                        <div className="text-xs text-gray-500">Всего</div>
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold text-blue-500">{stats.clients}</div>
                                        <div className="text-xs text-gray-500">Заказчики</div>
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold text-pink-500">{stats.influencers}</div>
                                        <div className="text-xs text-gray-500">Инфлюенсеры</div>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-white rounded-xl p-6 shadow-sm">
                                <h3 className="font-semibold mb-3">📋 Заказы</h3>
                                <div className="grid grid-cols-3 gap-3 text-center">
                                    <div>
                                        <div className="text-2xl font-bold text-purple-600">{stats.tasks}</div>
                                        <div className="text-xs text-gray-500">Всего</div>
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold text-blue-500">{stats.active_tasks}</div>
                                        <div className="text-xs text-gray-500">Активных</div>
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold text-green-500">{stats.completed_tasks}</div>
                                        <div className="text-xs text-gray-500">Завершено</div>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-white rounded-xl p-6 shadow-sm">
                                <h3 className="font-semibold mb-3">💰 Финансы</h3>
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Транзакций:</span>
                                        <span className="font-semibold">{stats.transactions}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Оборот:</span>
                                        <span className="font-semibold">{stats.revenue?.toLocaleString()} сом</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">На платформе:</span>
                                        <span className="font-semibold text-purple-600">{stats.platform_balance?.toLocaleString()} сом</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <p className="text-center py-10 text-gray-500">Загрузка статистики...</p>
                    )
                ) : null}
            </main>

            <footer className="text-center py-6 text-sm text-gray-400">
                Telegram Influencer Marketplace • Админ-панель (веб)
            </footer>
        </div>
    )
}

export default WebAdminSettings
