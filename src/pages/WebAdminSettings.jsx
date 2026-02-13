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
    const [activeTab, setActiveTab] = useState('settings')

    // Данные
    const [settings, setSettings] = useState({})
    const [users, setUsers] = useState([])
    const [tasks, setTasks] = useState([])
    const [submissions, setSubmissions] = useState([])
    const [withdrawals, setWithdrawals] = useState([])
    const [stats, setStats] = useState(null)
    const [saveStatus, setSaveStatus] = useState('')

    // Форма создания заказа
    const [newTask, setNewTask] = useState({
        clientId: '',
        title: '',
        description: '',
        budget: '',
        targetViews: '',
        targetLikes: '',
        targetComments: '',
        deadline: '',
        metricDeadlineDays: '7'
    })

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
        else if (activeTab === 'create-task') loadUsers() // нужны пользователи для выбора клиента
        else if (activeTab === 'submissions') loadSubmissions()
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
            // Загружаем пользователей с их influencer_profiles
            const { data, error } = await supabase
                .from('users')
                .select(`*, influencer_profiles(instagram_username, instagram_connected)`)
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
                .select(`
                    *, 
                    client:client_id(id, first_name, last_name, telegram_id),
                    influencer:influencer_id(id, first_name, last_name, telegram_id)
                `)
                .order('created_at', { ascending: false })
            if (error) throw error
            setTasks(data || [])
        } catch (error) {
            console.error('Ошибка загрузки заказов:', error)
        } finally {
            setLoading(false)
        }
    }

    const loadSubmissions = async () => {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('task_submissions')
                .select(`
                    *,
                    task:task_id(id, title, target_metrics, budget),
                    influencer:influencer_id(id, first_name, last_name, telegram_id)
                `)
                .order('created_at', { ascending: false })
            if (error) throw error
            setSubmissions(data || [])
        } catch (error) {
            console.error('Ошибка загрузки публикаций:', error)
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

    // === Действия: Настройки ===
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

    // === Действия: Пользователи ===
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

    const toggleAccountantRole = async (userId, currentRole) => {
        const newRole = currentRole === 'accountant' ? null : 'accountant'
        try {
            const { error } = await supabase.from('users').update({ role: newRole }).eq('id', userId)
            if (error) throw error
            setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u))
            alert(newRole === 'accountant' ? 'Назначен бухгалтером' : 'Роль бухгалтера снята')
        } catch (error) {
            console.error('Ошибка:', error)
            alert('Ошибка при изменении роли')
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

    const deleteUser = async (userId) => {
        const user = users.find(u => u.id === userId)
        if (!confirm(`Удалить пользователя ${user.first_name}?\nБаланс: ${user.balance || 0} сом`)) return
        try {
            const { error } = await supabase.rpc('admin_soft_delete_user', {
                p_user_id: userId,
                p_admin_reason: 'Удален через веб-админ'
            })
            if (error) throw error
            setUsers(users.filter(u => u.id !== userId))
            alert('Пользователь удален')
        } catch (error) {
            console.error('Ошибка:', error)
            alert('Ошибка при удалении')
        }
    }

    const updateInstagramUsername = async (userId) => {
        const username = prompt('Instagram username (без @):')
        if (!username) return
        try {
            // Проверяем существует ли профиль
            const { data: existing } = await supabase
                .from('influencer_profiles')
                .select('id')
                .eq('user_id', userId)
                .maybeSingle()

            if (existing) {
                const { error } = await supabase
                    .from('influencer_profiles')
                    .update({ instagram_username: username.replace('@', '') })
                    .eq('user_id', userId)
                if (error) throw error
            } else {
                const { error } = await supabase
                    .from('influencer_profiles')
                    .insert({ user_id: userId, instagram_username: username.replace('@', '') })
                if (error) throw error
            }
            loadUsers()
            alert('Instagram username обновлён')
        } catch (error) {
            console.error('Ошибка:', error)
            alert('Ошибка при обновлении')
        }
    }

    // === Действия: Заказы ===
    const deleteTask = async (taskId) => {
        const reason = prompt('Причина удаления заказа:')
        if (!reason) return
        if (!confirm('Удалить заказ? Средства будут возвращены заказчику.')) return
        try {
            const { data, error } = await supabase.rpc('admin_delete_task', {
                p_task_id: taskId,
                p_admin_reason: reason
            })
            if (error) throw error
            setTasks(tasks.filter(t => t.id !== taskId))
            alert(data.refunded_amount > 0 ? `Заказ удален. Возвращено ${data.refunded_amount} сом` : 'Заказ удален')
        } catch (error) {
            console.error('Ошибка:', error)
            alert('Ошибка при удалении: ' + error.message)
        }
    }

    // === Действия: Создание заказа ===
    const createTask = async (e) => {
        e.preventDefault()
        if (!newTask.title || !newTask.description || !newTask.budget || !newTask.clientId || !newTask.deadline) {
            alert('Заполните все обязательные поля')
            return
        }
        if (new Date(newTask.deadline) < new Date()) {
            alert('Дедлайн не может быть в прошлом')
            return
        }
        setLoading(true)
        try {
            const targetMetrics = {}
            if (newTask.targetViews) targetMetrics.views = parseInt(newTask.targetViews)
            if (newTask.targetLikes) targetMetrics.likes = parseInt(newTask.targetLikes)
            if (newTask.targetComments) targetMetrics.comments = parseInt(newTask.targetComments)

            const { data, error } = await supabase
                .from('tasks')
                .insert([{
                    client_id: newTask.clientId,
                    title: newTask.title,
                    description: newTask.description,
                    budget: parseFloat(newTask.budget),
                    target_metrics: Object.keys(targetMetrics).length > 0 ? targetMetrics : null,
                    metric_deadline_days: parseInt(newTask.metricDeadlineDays) || 7,
                    deadline: newTask.deadline,
                    status: 'open',
                    accepted_count: 0
                }])
                .select()
                .single()

            if (error) throw error

            alert('Заказ успешно создан!')
            setNewTask({
                clientId: '',
                title: '',
                description: '',
                budget: '',
                targetViews: '',
                targetLikes: '',
                targetComments: '',
                deadline: '',
                metricDeadlineDays: '7'
            })
            setActiveTab('tasks')
            loadTasks()
        } catch (error) {
            console.error('Ошибка:', error)
            alert('Ошибка при создании заказа: ' + error.message)
        } finally {
            setLoading(false)
        }
    }

    // === Действия: Публикации (submissions) ===
    const updateSubmissionMetrics = async (submissionId) => {
        const sub = submissions.find(s => s.id === submissionId)
        const views = prompt('Просмотры:', sub?.current_metrics?.views || 0)
        if (views === null) return
        const likes = prompt('Лайки:', sub?.current_metrics?.likes || 0)
        if (likes === null) return
        const comments = prompt('Комментарии:', sub?.current_metrics?.comments || 0)
        if (comments === null) return

        try {
            const metrics = {
                views: parseInt(views) || 0,
                likes: parseInt(likes) || 0,
                comments: parseInt(comments) || 0,
                captured_at: Math.floor(Date.now() / 1000),
                manual_entry: true,
                updated_by_admin: true
            }
            const { error } = await supabase
                .from('task_submissions')
                .update({ current_metrics: metrics })
                .eq('id', submissionId)
            if (error) throw error
            loadSubmissions()
            alert('Метрики обновлены')
        } catch (error) {
            console.error('Ошибка:', error)
            alert('Ошибка при обновлении метрик')
        }
    }

    const completeSubmission = async (submissionId) => {
        if (!confirm('Завершить задание и выплатить инфлюенсеру?')) return
        try {
            const sub = submissions.find(s => s.id === submissionId)
            // Обновляем статус submission
            const { error: subError } = await supabase
                .from('task_submissions')
                .update({ status: 'completed' })
                .eq('id', submissionId)
            if (subError) throw subError

            // Обновляем статус задания
            const { error: taskError } = await supabase
                .from('tasks')
                .update({ status: 'completed' })
                .eq('id', sub.task_id)
            if (taskError) throw taskError

            // Выплата инфлюенсеру (80% бюджета)
            const payout = Math.floor((sub.task?.budget || 0) * 0.8)
            if (payout > 0) {
                await supabase.rpc('increment_balance', {
                    p_user_id: sub.influencer_id,
                    p_amount: payout
                })
                await supabase.from('transactions').insert({
                    to_user_id: sub.influencer_id,
                    amount: payout,
                    type: 'payout',
                    status: 'completed',
                    description: `Выплата за заказ: ${sub.task?.title}`
                })
            }

            loadSubmissions()
            alert(`Задание завершено. Выплачено ${payout} сом`)
        } catch (error) {
            console.error('Ошибка:', error)
            alert('Ошибка: ' + error.message)
        }
    }

    // === Действия: Выплаты ===
    const processWithdrawal = async (requestId, status) => {
        const note = status === 'rejected' ? prompt('Причина отклонения:') : prompt('Комментарий (опционально):')
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

    const isManualMode = settings.instagram_metrics_mode?.value === 'manual'

    // Панель админа
    return (
        <div className="min-h-screen bg-gray-100">
            {/* Header */}
            <header className="bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg">
                <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Logo className="h-8" />
                        <h1 className="text-xl font-bold">🔧 Админ-панель</h1>
                        {isManualMode && <span className="text-xs bg-orange-500 px-2 py-1 rounded-full">✍️ Ручной режим</span>}
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
                            { id: 'create-task', label: '➕ Создать заказ' },
                            { id: 'submissions', label: `📝 Публикации (${submissions.filter(s => s.status !== 'completed').length})` },
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
                                        {isManualMode ? '✍️ Ручной (ввод админом/заказчиком)' : '🤖 Автоматический (через Instagram API)'}
                                    </p>
                                </div>
                                <button onClick={toggleMetricsMode}
                                    className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors ${isManualMode ? 'bg-orange-500' : 'bg-green-500'
                                        }`}>
                                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${isManualMode ? 'translate-x-8' : 'translate-x-1'
                                        }`} />
                                </button>
                            </div>
                            {saveStatus && <div className="mt-4 text-center text-sm font-medium">{saveStatus}</div>}
                        </div>

                        {isManualMode && (
                            <div className="bg-orange-50 border border-orange-200 rounded-xl p-6">
                                <h3 className="font-semibold text-orange-900 mb-3">📖 Инструкция по ручному режиму</h3>
                                <ol className="text-sm text-orange-800 space-y-2 list-decimal list-inside">
                                    <li>Инфлюенсер отправляет ссылку на публикацию (без подключения Instagram)</li>
                                    <li>Заказчик проверяет публикацию и вводит текущие метрики</li>
                                    <li>Админ может обновлять метрики в разделе "📝 Публикации"</li>
                                    <li>Когда цели достигнуты — админ вручную завершает задание и выплачивает</li>
                                </ol>
                            </div>
                        )}
                    </div>
                ) : activeTab === 'users' ? (
                    // === Пользователи ===
                    <div className="space-y-3">
                        {users.map(user => (
                            <div key={user.id} className="bg-white rounded-xl p-4 shadow-sm">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <h3 className="font-semibold">{user.first_name} {user.last_name || ''}</h3>
                                        <p className="text-sm text-gray-500">
                                            @{user.username || 'без username'} • Telegram: {user.telegram_id}
                                        </p>
                                        <p className="text-sm">💰 Баланс: <strong>{user.balance?.toLocaleString() || 0} сом</strong></p>
                                        {user.influencer_profiles?.[0]?.instagram_username && (
                                            <p className="text-sm text-pink-600">
                                                📸 Instagram: @{user.influencer_profiles[0].instagram_username}
                                                {user.influencer_profiles[0].instagram_connected && ' ✓'}
                                            </p>
                                        )}
                                    </div>
                                    <div className="text-right">
                                        <span className={`text-xs px-2 py-1 rounded-full ${user.user_type === 'client' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                                            }`}>
                                            {user.user_type === 'client' ? '💼 Заказчик' : '📸 Инфлюенсер'}
                                        </span>
                                        {user.role === 'accountant' && (
                                            <span className="text-xs px-2 py-1 rounded-full bg-orange-100 text-orange-800 ml-1">
                                                👔 Бухгалтер
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex gap-2 flex-wrap">
                                    <button onClick={() => toggleUserType(user.id, user.user_type)}
                                        className="text-xs px-3 py-1 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
                                        {user.user_type === 'client' ? '→ Инфлюенсер' : '→ Заказчик'}
                                    </button>
                                    <button onClick={() => toggleAccountantRole(user.id, user.role)}
                                        className={`text-xs px-3 py-1 rounded-lg ${user.role === 'accountant' ? 'bg-orange-500 text-white' : 'bg-purple-500 text-white'
                                            }`}>
                                        {user.role === 'accountant' ? '❌ Снять бухгалтера' : '👔 Бухгалтер'}
                                    </button>
                                    <button onClick={() => addBalance(user.id)}
                                        className="text-xs px-3 py-1 bg-green-500 text-white rounded-lg hover:bg-green-600">
                                        💰 Пополнить
                                    </button>
                                    {user.user_type === 'influencer' && (
                                        <button onClick={() => updateInstagramUsername(user.id)}
                                            className="text-xs px-3 py-1 bg-pink-500 text-white rounded-lg hover:bg-pink-600">
                                            📸 Instagram
                                        </button>
                                    )}
                                    <button onClick={() => deleteUser(user.id)}
                                        className="text-xs px-3 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600">
                                        🗑️ Удалить
                                    </button>
                                </div>
                                <p className="text-xs text-gray-400 mt-2">
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
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex-1">
                                        <h3 className="font-semibold mb-1">{task.title}</h3>
                                        <p className="text-sm text-gray-500 mb-2">{task.description?.slice(0, 150)}...</p>
                                        <p className="text-sm">💼 Заказчик: {task.client?.first_name} {task.client?.last_name || ''}</p>
                                        {task.influencer && (
                                            <p className="text-sm">📸 Инфлюенсер: {task.influencer.first_name} {task.influencer.last_name || ''}</p>
                                        )}
                                        <p className="text-sm">💰 Бюджет: {formatTaskBudget(task, { prefix: '' })}</p>
                                        {task.target_metrics && (
                                            <p className="text-sm text-gray-600">
                                                🎯 Цели: {task.target_metrics.views && `👁${task.target_metrics.views}`} {task.target_metrics.likes && `❤️${task.target_metrics.likes}`} {task.target_metrics.comments && `💬${task.target_metrics.comments}`}
                                            </p>
                                        )}
                                    </div>
                                    <span className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${task.status === 'open' ? 'bg-green-100 text-green-800' :
                                        task.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                                            task.status === 'completed' ? 'bg-gray-100 text-gray-800' : 'bg-red-100 text-red-800'
                                        }`}>
                                        {task.status === 'open' ? '🟢 Открыт' :
                                            task.status === 'in_progress' ? '🔵 В работе' :
                                                task.status === 'completed' ? '✅ Завершен' : '❌ ' + task.status}
                                    </span>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => deleteTask(task.id)}
                                        className="text-xs px-3 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600">
                                        🗑️ Удалить заказ
                                    </button>
                                </div>
                                <p className="text-xs text-gray-400 mt-2">ID: {task.id} • Создан: {new Date(task.created_at).toLocaleDateString('ru')}</p>
                            </div>
                        ))}
                        {tasks.length === 0 && <p className="text-center py-10 text-gray-500">Нет заказов</p>}
                    </div>
                ) : activeTab === 'create-task' ? (
                    // === Создать заказ ===
                    <div className="max-w-2xl mx-auto">
                        <div className="bg-white rounded-xl shadow-sm p-6">
                            <h2 className="text-lg font-semibold mb-4">➕ Создать новый заказ</h2>
                            <form onSubmit={createTask} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Заказчик *</label>
                                    <select
                                        value={newTask.clientId}
                                        onChange={(e) => setNewTask({ ...newTask, clientId: e.target.value })}
                                        className="w-full p-3 border border-gray-300 rounded-lg"
                                        required
                                    >
                                        <option value="">Выберите заказчика</option>
                                        {users.filter(u => u.user_type === 'client' || u.telegram_id === 7737197594).map(user => (
                                            <option key={user.id} value={user.id}>
                                                {user.first_name} {user.last_name || ''} (@{user.username || user.telegram_id})
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-gray-500 mt-1">Можно выбрать себя (админа) или любого заказчика</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1">Название задания *</label>
                                    <input
                                        type="text"
                                        value={newTask.title}
                                        onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                                        className="w-full p-3 border border-gray-300 rounded-lg"
                                        placeholder="Например: Реклама нового продукта"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1">Описание *</label>
                                    <textarea
                                        value={newTask.description}
                                        onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                                        className="w-full p-3 border border-gray-300 rounded-lg h-32"
                                        placeholder="Подробное описание задания..."
                                        required
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">💰 Бюджет (сом) *</label>
                                        <input
                                            type="number"
                                            value={newTask.budget}
                                            onChange={(e) => setNewTask({ ...newTask, budget: e.target.value })}
                                            className="w-full p-3 border border-gray-300 rounded-lg"
                                            placeholder="5000"
                                            min="100"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">📅 Дедлайн *</label>
                                        <input
                                            type="date"
                                            value={newTask.deadline}
                                            onChange={(e) => setNewTask({ ...newTask, deadline: e.target.value })}
                                            className="w-full p-3 border border-gray-300 rounded-lg"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="bg-gray-50 rounded-lg p-4">
                                    <h3 className="font-medium mb-3">🎯 Целевые метрики (опционально)</h3>
                                    <div className="grid grid-cols-3 gap-3">
                                        <div>
                                            <label className="block text-xs mb-1">👁 Просмотры</label>
                                            <input
                                                type="number"
                                                value={newTask.targetViews}
                                                onChange={(e) => setNewTask({ ...newTask, targetViews: e.target.value })}
                                                className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                                                placeholder="10000"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs mb-1">❤️ Лайки</label>
                                            <input
                                                type="number"
                                                value={newTask.targetLikes}
                                                onChange={(e) => setNewTask({ ...newTask, targetLikes: e.target.value })}
                                                className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                                                placeholder="500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs mb-1">💬 Комментарии</label>
                                            <input
                                                type="number"
                                                value={newTask.targetComments}
                                                onChange={(e) => setNewTask({ ...newTask, targetComments: e.target.value })}
                                                className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                                                placeholder="50"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1">⏱ Дней на набор метрик</label>
                                    <input
                                        type="number"
                                        value={newTask.metricDeadlineDays}
                                        onChange={(e) => setNewTask({ ...newTask, metricDeadlineDays: e.target.value })}
                                        className="w-full p-3 border border-gray-300 rounded-lg"
                                        placeholder="7"
                                        min="1"
                                        max="30"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 disabled:opacity-50"
                                >
                                    {loading ? 'Создание...' : '✅ Создать заказ'}
                                </button>
                            </form>
                        </div>
                    </div>
                ) : activeTab === 'submissions' ? (
                    // === Публикации ===
                    <div className="space-y-3">
                        {isManualMode && (
                            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
                                <p className="text-sm text-orange-800">
                                    <strong>✍️ Ручной режим активен.</strong> Вы можете обновлять метрики и завершать задания вручную.
                                </p>
                            </div>
                        )}
                        {submissions.map(sub => (
                            <div key={sub.id} className="bg-white rounded-xl p-4 shadow-sm">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex-1">
                                        <h3 className="font-semibold mb-1">{sub.task?.title || 'Задание удалено'}</h3>
                                        <p className="text-sm">📸 Инфлюенсер: {sub.influencer?.first_name} {sub.influencer?.last_name || ''}</p>
                                        <p className="text-sm text-blue-600 break-all">
                                            🔗 <a href={sub.post_url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                                {sub.post_url}
                                            </a>
                                        </p>
                                    </div>
                                    <span className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${sub.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                        sub.status === 'pending_approval' ? 'bg-orange-100 text-orange-800' :
                                            sub.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                                                sub.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                        }`}>
                                        {sub.status === 'pending' ? '⏳ Ожидает' :
                                            sub.status === 'pending_approval' ? '🔍 На проверке' :
                                                sub.status === 'in_progress' ? '🔵 В работе' :
                                                    sub.status === 'completed' ? '✅ Завершено' : sub.status}
                                    </span>
                                </div>

                                {/* Метрики */}
                                <div className="bg-gray-50 rounded-lg p-3 mb-3">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-sm font-medium">📊 Текущие метрики:</span>
                                        {sub.current_metrics?.manual_entry && (
                                            <span className="text-xs text-orange-600">✍️ Ручной ввод</span>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 text-center">
                                        <div>
                                            <div className="text-lg font-bold">{sub.current_metrics?.views?.toLocaleString() || 0}</div>
                                            <div className="text-xs text-gray-500">👁 Просмотры</div>
                                        </div>
                                        <div>
                                            <div className="text-lg font-bold">{sub.current_metrics?.likes?.toLocaleString() || 0}</div>
                                            <div className="text-xs text-gray-500">❤️ Лайки</div>
                                        </div>
                                        <div>
                                            <div className="text-lg font-bold">{sub.current_metrics?.comments?.toLocaleString() || 0}</div>
                                            <div className="text-xs text-gray-500">💬 Комменты</div>
                                        </div>
                                    </div>
                                    {sub.task?.target_metrics && (
                                        <div className="mt-2 pt-2 border-t text-xs text-gray-500">
                                            🎯 Цели: {sub.task.target_metrics.views && `👁${sub.task.target_metrics.views}`} {sub.task.target_metrics.likes && `❤️${sub.task.target_metrics.likes}`} {sub.task.target_metrics.comments && `💬${sub.task.target_metrics.comments}`}
                                        </div>
                                    )}
                                </div>

                                {/* Действия */}
                                {sub.status !== 'completed' && sub.status !== 'rejected' && (
                                    <div className="flex gap-2 flex-wrap">
                                        <button onClick={() => updateSubmissionMetrics(sub.id)}
                                            className="text-xs px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium">
                                            ✍️ Обновить метрики
                                        </button>
                                        {(sub.status === 'in_progress' || sub.status === 'pending_approval') && (
                                            <button onClick={() => completeSubmission(sub.id)}
                                                className="text-xs px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium">
                                                ✅ Завершить и выплатить
                                            </button>
                                        )}
                                    </div>
                                )}

                                <p className="text-xs text-gray-400 mt-2">
                                    Отправлено: {new Date(sub.submitted_at || sub.created_at).toLocaleString('ru')}
                                </p>
                            </div>
                        ))}
                        {submissions.length === 0 && <p className="text-center py-10 text-gray-500">Нет публикаций</p>}
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
                                        <p className="text-sm">💰 Текущий баланс: {request.users?.balance?.toLocaleString()} сом</p>
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

                                {/* Детали платежа */}
                                <div className="bg-gray-50 rounded-lg p-3 mb-3">
                                    <p className="text-sm font-medium mb-2">
                                        {request.payment_method === 'kaspi' ? '📱 Kaspi Gold' : '💳 Банковская карта'}
                                    </p>
                                    {request.payment_method === 'kaspi' && request.payment_details && (
                                        <div className="text-sm">
                                            <p>📞 Телефон: <strong>{request.payment_details.phoneNumber || request.payment_details}</strong></p>
                                        </div>
                                    )}
                                    {request.payment_method === 'card' && request.payment_details && (
                                        <div className="text-sm space-y-1">
                                            <p>💳 Карта: <strong>{request.payment_details.cardNumber}</strong></p>
                                            <p>👤 Владелец: <strong>{request.payment_details.cardHolder}</strong></p>
                                        </div>
                                    )}
                                    {typeof request.payment_details === 'string' && (
                                        <p className="text-sm"><strong>{request.payment_details}</strong></p>
                                    )}
                                </div>

                                {request.admin_note && (
                                    <div className="bg-blue-50 rounded-lg p-3 mb-3">
                                        <p className="text-xs text-gray-500 mb-1">Комментарий:</p>
                                        <p className="text-sm">{request.admin_note}</p>
                                    </div>
                                )}

                                {request.status === 'pending' && (
                                    <div className="flex gap-2">
                                        <button onClick={() => processWithdrawal(request.id, 'approved')}
                                            className="flex-1 bg-green-500 text-white py-2 rounded-lg hover:bg-green-600 font-medium">
                                            ✅ Одобрить и выплатить
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
                Telegram Influencer Marketplace • Веб-админ панель
            </footer>
        </div>
    )
}

export default WebAdminSettings
