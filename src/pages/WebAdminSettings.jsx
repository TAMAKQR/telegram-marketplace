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
        metricDeadlineDays: '7',
        maxInfluencers: '',
        minFollowers: '',
        minEngagementRate: '',
        usePricingTiers: false
    })

    // Ценовые диапазоны (лесенка)
    const [pricingTiers, setPricingTiers] = useState([
        { min: '', max: '', price: '', metric: 'views' }
    ])

    // === Вспомогательные функции для лесенки ===
    const parseOptionalInt = (value) => {
        if (value === null || value === undefined) return null
        const trimmed = String(value).trim()
        if (trimmed === '') return null
        const parsed = parseInt(trimmed, 10)
        return Number.isFinite(parsed) ? parsed : null
    }

    const parseOptionalNumber = (value) => {
        if (value === null || value === undefined) return null
        const trimmed = String(value).trim()
        if (trimmed === '') return null
        const parsed = parseFloat(trimmed)
        return Number.isFinite(parsed) ? parsed : null
    }

    const metricLabel = (metric) => {
        switch (metric) {
            case 'views': return 'Просмотры'
            case 'likes': return 'Лайки'
            case 'comments': return 'Комментарии'
            default: return metric
        }
    }

    const normalizePricingTiers = (tiers) => {
        const normalized = tiers.map((tier) => {
            const min = parseOptionalInt(tier.min)
            const max = parseOptionalInt(tier.max)
            const price = parseOptionalNumber(tier.price)
            return { metric: tier.metric || 'views', min, max, price }
        })

        const errors = Array.from({ length: tiers.length }, () => [])

        normalized.forEach((t, idx) => {
            if (t.min === null) errors[idx].push('Укажите "От" (min)')
            if (t.min !== null && t.min < 0) errors[idx].push('"От" не может быть отрицательным')
            if (t.max !== null && t.max < 0) errors[idx].push('"До" не может быть отрицательным')
            if (t.min !== null && t.max !== null && t.max < t.min) errors[idx].push('"До" должно быть ≥ "От"')
            if (t.price === null) errors[idx].push('Укажите цену (можно 0)')
            if (t.price !== null && t.price < 0) errors[idx].push('Цена не может быть отрицательной')
        })

        const seen = new Map()
        normalized.forEach((t, idx) => {
            if (t.min === null) return
            const key = `${t.metric}:${t.min}`
            const list = seen.get(key) || []
            list.push(idx)
            seen.set(key, list)
        })
        for (const [key, idxs] of seen.entries()) {
            if (idxs.length <= 1) continue
            const [metric, min] = key.split(':')
            idxs.forEach((i) => {
                errors[i].push(`Дубликат порога: ${metricLabel(metric)} от ${Number(min).toLocaleString()}`)
            })
        }

        const valid = normalized.filter((t, idx) => {
            if (t.min === null && t.price === null && t.max === null) return false
            return errors[idx].length === 0
        })

        const hasBlockingErrors = errors.some(e => e.length > 0)
        return { normalized, errors, valid, hasBlockingErrors }
    }

    const addPricingTier = () => {
        setPricingTiers([...pricingTiers, { min: '', max: '', price: '', metric: 'views' }])
    }

    const addNextPricingTier = () => {
        const last = pricingTiers[pricingTiers.length - 1] || { min: '', max: '', price: '', metric: 'views' }
        const lastMin = parseOptionalInt(last.min)
        const lastMax = parseOptionalInt(last.max)
        const nextMin = lastMax !== null ? String(lastMax + 1) : (lastMin !== null ? String(lastMin) : '')
        setPricingTiers([...pricingTiers, { min: nextMin, max: '', price: '', metric: last.metric || 'views' }])
    }

    const sortPricingTiers = () => {
        const order = { views: 0, likes: 1, comments: 2 }
        const sorted = [...pricingTiers].sort((a, b) => {
            const metricDiff = (order[a.metric] ?? 99) - (order[b.metric] ?? 99)
            if (metricDiff !== 0) return metricDiff
            const amin = parseOptionalInt(a.min)
            const bmin = parseOptionalInt(b.min)
            if (amin === null && bmin === null) return 0
            if (amin === null) return 1
            if (bmin === null) return -1
            return amin - bmin
        })
        setPricingTiers(sorted)
    }

    const removePricingTier = (index) => {
        setPricingTiers(pricingTiers.filter((_, i) => i !== index))
    }

    const updatePricingTier = (index, field, value) => {
        const updated = [...pricingTiers]
        updated[index][field] = value
        setPricingTiers(updated)
    }

    // Проверяем сохранённую сессию и предзагружаем данные
    useEffect(() => {
        const savedAuth = sessionStorage.getItem('webAdminAuth')
        if (savedAuth === 'true') {
            setIsAuthenticated(true)
            // Предзагрузка данных при восстановлении сессии
            loadUsers()
            loadTasks()
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
        console.log('Login attempt:', { login, password, expected: { WEB_ADMIN_LOGIN, WEB_ADMIN_PASSWORD } })
        if (login === WEB_ADMIN_LOGIN && password === WEB_ADMIN_PASSWORD) {
            setIsAuthenticated(true)
            sessionStorage.setItem('webAdminAuth', 'true')
            setAuthError('')
            // Предзагрузка данных
            loadUsers()
            loadTasks()
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
                    client:client_id(id, first_name, last_name, telegram_id)
                `)
                .order('created_at', { ascending: false })
            console.log('loadTasks result:', { data, error, count: data?.length })
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
                    task:task_id(id, title, target_metrics, budget)
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
                .select('*')
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

        // Базовая валидация
        if (!newTask.title || !newTask.description || !newTask.clientId || !newTask.deadline) {
            alert('Заполните все обязательные поля')
            return
        }

        // Проверка бюджета только если НЕ используются pricing tiers
        if (!newTask.usePricingTiers && !newTask.budget) {
            alert('Укажите бюджет задания')
            return
        }

        // Валидация pricing tiers
        if (newTask.usePricingTiers) {
            const { valid, hasBlockingErrors } = normalizePricingTiers(pricingTiers)
            if (valid.length === 0) {
                alert('Добавьте хотя бы один корректный порог (min + цена). Поле "До" можно оставить пустым.')
                return
            }
            if (hasBlockingErrors) {
                alert('Есть ошибки в ценовых диапазонах. Проверьте подсказки под полями.')
                return
            }
        }

        if (new Date(newTask.deadline) < new Date()) {
            alert('Дедлайн не может быть в прошлом')
            return
        }

        setLoading(true)
        try {
            // Requirements
            const requirements = {}
            if (newTask.minFollowers) requirements.minFollowers = parseInt(newTask.minFollowers)
            if (newTask.minEngagementRate) requirements.minEngagementRate = parseFloat(newTask.minEngagementRate)

            // Target metrics
            const targetMetrics = {}
            if (newTask.targetViews) targetMetrics.views = parseInt(newTask.targetViews)
            if (newTask.targetLikes) targetMetrics.likes = parseInt(newTask.targetLikes)
            if (newTask.targetComments) targetMetrics.comments = parseInt(newTask.targetComments)

            // Pricing tiers (лесенка)
            let finalPricingTiers = null
            if (newTask.usePricingTiers) {
                const { valid } = normalizePricingTiers(pricingTiers)
                finalPricingTiers = valid.map(tier => ({
                    min: tier.min,
                    max: tier.max,
                    price: tier.price,
                    metric: tier.metric
                }))

                // Автоматически генерируем target_metrics из МИНИМАЛЬНЫХ значений pricing_tiers
                const minMetrics = {}
                finalPricingTiers.forEach(tier => {
                    const currentMin = minMetrics[tier.metric]
                    if (currentMin === undefined || tier.min < currentMin) {
                        minMetrics[tier.metric] = tier.min
                    }
                })
                Object.keys(minMetrics).forEach(metric => {
                    targetMetrics[metric] = minMetrics[metric]
                })
            }

            // Преобразуем deadline в ISO формат с временем
            const deadlineDate = new Date(newTask.deadline)
            deadlineDate.setHours(23, 59, 59, 0)
            const deadlineISO = deadlineDate.toISOString()

            const taskData = {
                client_id: newTask.clientId,
                title: newTask.title,
                description: newTask.description,
                budget: newTask.usePricingTiers ? 0 : parseFloat(newTask.budget),
                requirements: Object.keys(requirements).length > 0 ? requirements : null,
                target_metrics: Object.keys(targetMetrics).length > 0 ? targetMetrics : null,
                pricing_tiers: finalPricingTiers,
                metric_deadline_days: parseInt(newTask.metricDeadlineDays) || 7,
                max_influencers: newTask.maxInfluencers ? parseInt(newTask.maxInfluencers) : null,
                deadline: deadlineISO,
                status: 'open',
                accepted_count: 0
            }

            console.log('Creating task with data:', taskData)

            const { data, error } = await supabase
                .from('tasks')
                .insert([taskData])
                .select()
                .single()

            console.log('Create task result:', { data, error })

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
                metricDeadlineDays: '7',
                maxInfluencers: '',
                minFollowers: '',
                minEngagementRate: '',
                usePricingTiers: false
            })
            setPricingTiers([{ min: '', max: '', price: '', metric: 'views' }])
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
                                className="w-full p-3 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-400" placeholder="Введите логин" required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Пароль</label>
                            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                                className="w-full p-3 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-400" placeholder="Введите пароль" required />
                        </div>
                        {authError && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{authError}</div>}
                        <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700">Войти</button>
                    </form>
                </div>
            </div>
        )
    }

    const isManualMode = settings.instagram_metrics_mode?.value === 'manual'

    const tabs = [
        { id: 'settings', icon: '⚙️', label: 'Настройки', badge: null },
        { id: 'users', icon: '👥', label: 'Пользователи', badge: users.length || null },
        { id: 'tasks', icon: '📋', label: 'Заказы', badge: tasks.length || null },
        { id: 'create-task', icon: '➕', label: 'Создать заказ', badge: null },
        { id: 'submissions', icon: '📝', label: 'Публикации', badge: submissions.filter(s => s.status !== 'completed').length || null },
        { id: 'withdrawals', icon: '💸', label: 'Выплаты', badge: withdrawals.filter(w => w.status === 'pending').length || null },
        { id: 'stats', icon: '📊', label: 'Статистика', badge: null },
    ]

    // Панель админа
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex">
            {/* Sidebar */}
            <aside className="hidden lg:flex lg:flex-col w-72 bg-gradient-to-b from-slate-900 to-slate-800 text-white">
                {/* Logo */}
                <div className="p-6 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <Logo className="h-10" />
                        <div>
                            <h1 className="font-bold text-lg">Admin Panel</h1>
                            <p className="text-xs text-slate-400">Управление платформой</p>
                        </div>
                    </div>
                </div>

                {/* Mode indicator */}
                {isManualMode && (
                    <div className="mx-4 mt-4 bg-orange-500/20 border border-orange-500/30 rounded-xl p-3">
                        <div className="flex items-center gap-2 text-orange-400">
                            <span className="text-lg">✍️</span>
                            <div>
                                <p className="text-sm font-medium">Ручной режим</p>
                                <p className="text-xs text-orange-300/70">Метрики вводятся вручную</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Navigation */}
                <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-200 ${activeTab === tab.id
                                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/25'
                                : 'text-slate-300 hover:bg-white/10 hover:text-white'
                                }`}
                        >
                            <span className="text-xl">{tab.icon}</span>
                            <span className="font-medium">{tab.label}</span>
                            {tab.badge > 0 && (
                                <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-semibold ${activeTab === tab.id ? 'bg-white/20' : 'bg-slate-600'
                                    }`}>
                                    {tab.badge}
                                </span>
                            )}
                        </button>
                    ))}
                </nav>

                {/* Logout */}
                <div className="p-4 border-t border-white/10">
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                    >
                        <span>🚪</span>
                        <span>Выйти</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Mobile Header */}
                <header className="lg:hidden bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg">
                    <div className="px-4 py-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Logo className="h-8" />
                            <h1 className="text-lg font-bold">Админ-панель</h1>
                        </div>
                        <button onClick={handleLogout} className="text-white/80 hover:text-white px-3 py-1 rounded-lg hover:bg-white/10">
                            Выйти
                        </button>
                    </div>
                    {/* Mobile Tabs */}
                    <div className="px-2 pb-2 overflow-x-auto flex gap-1">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg whitespace-nowrap text-sm font-medium transition-colors ${activeTab === tab.id
                                    ? 'bg-white text-purple-600'
                                    : 'text-white/80 hover:bg-white/10'
                                    }`}
                            >
                                <span>{tab.icon}</span>
                                <span className="hidden sm:inline">{tab.label}</span>
                                {tab.badge > 0 && (
                                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === tab.id ? 'bg-purple-100' : 'bg-white/20'
                                        }`}>
                                        {tab.badge}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </header>

                {/* Desktop Header */}
                <header className="hidden lg:block bg-white/50 backdrop-blur-sm border-b border-slate-200/50 sticky top-0 z-10">
                    <div className="px-8 py-6">
                        <h2 className="text-2xl font-bold text-slate-800">
                            {tabs.find(t => t.id === activeTab)?.icon} {tabs.find(t => t.id === activeTab)?.label}
                        </h2>
                        <p className="text-slate-500 text-sm mt-1">
                            {activeTab === 'settings' && 'Настройки системы и режима работы'}
                            {activeTab === 'users' && `Управление пользователями платформы`}
                            {activeTab === 'tasks' && `Просмотр и управление заказами`}
                            {activeTab === 'create-task' && 'Создание нового заказа от имени заказчика'}
                            {activeTab === 'submissions' && 'Проверка публикаций инфлюенсеров'}
                            {activeTab === 'withdrawals' && 'Обработка заявок на вывод средств'}
                            {activeTab === 'stats' && 'Аналитика и статистика платформы'}
                        </p>
                    </div>
                </header>

                {/* Content */}
                <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
                    {loading ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="text-center">
                                <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent mx-auto mb-4"></div>
                                <p className="text-slate-500">Загрузка...</p>
                            </div>
                        </div>
                    ) : activeTab === 'settings' ? (
                        // === Настройки ===
                        <div className="max-w-3xl space-y-6">
                            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/50 overflow-hidden">
                                <div className="p-6 border-b border-slate-100">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-2xl">
                                            📸
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-bold text-slate-800">Instagram метрики</h2>
                                            <p className="text-sm text-slate-500">Настройка режима сбора данных</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-6">
                                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
                                        <div className="flex gap-3">
                                            <span className="text-2xl">⚠️</span>
                                            <div>
                                                <p className="font-semibold text-amber-800">Instagram API на проверке</p>
                                                <p className="text-sm text-amber-700 mt-1">
                                                    Если автоматический сбор не работает, включите ручной режим для продолжения работы.
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between p-5 bg-slate-50 rounded-xl">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl ${isManualMode ? 'bg-orange-100' : 'bg-green-100'
                                                }`}>
                                                {isManualMode ? '✍️' : '🤖'}
                                            </div>
                                            <div>
                                                <p className="font-semibold text-slate-800">Режим сбора метрик</p>
                                                <p className="text-sm text-slate-500">
                                                    {isManualMode ? 'Ручной — ввод админом или заказчиком' : 'Автоматический — через Instagram API'}
                                                </p>
                                            </div>
                                        </div>
                                        <button onClick={toggleMetricsMode}
                                            className={`relative inline-flex h-8 w-16 items-center rounded-full transition-all duration-300 shadow-inner ${isManualMode ? 'bg-orange-500' : 'bg-green-500'
                                                }`}>
                                            <span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition-transform duration-300 ${isManualMode ? 'translate-x-9' : 'translate-x-1'
                                                }`} />
                                        </button>
                                    </div>
                                    {saveStatus && (
                                        <div className="mt-4 text-center text-sm font-medium text-green-600 bg-green-50 rounded-lg py-2">
                                            {saveStatus}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {isManualMode && (
                                <div className="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200 rounded-2xl p-6">
                                    <div className="flex items-center gap-3 mb-4">
                                        <span className="text-2xl">📖</span>
                                        <h3 className="font-bold text-orange-900">Инструкция по ручному режиму</h3>
                                    </div>
                                    <div className="grid gap-3">
                                        {[
                                            { step: 1, text: 'Инфлюенсер отправляет ссылку на публикацию (без подключения Instagram)' },
                                            { step: 2, text: 'Заказчик проверяет публикацию и вводит текущие метрики' },
                                            { step: 3, text: 'Админ может обновлять метрики в разделе "📝 Публикации"' },
                                            { step: 4, text: 'Когда цели достигнуты — админ завершает задание и выплачивает' },
                                        ].map(item => (
                                            <div key={item.step} className="flex items-start gap-3 bg-white/50 rounded-xl p-3">
                                                <span className="w-7 h-7 rounded-full bg-orange-500 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                                                    {item.step}
                                                </span>
                                                <p className="text-sm text-orange-800 pt-1">{item.text}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : activeTab === 'users' ? (
                        // === Пользователи ===
                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                            {users.map(user => (
                                <div key={user.id} className="bg-white rounded-2xl border border-slate-200/50 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                                    {/* Header */}
                                    <div className={`p-4 ${user.user_type === 'client' ? 'bg-gradient-to-r from-blue-500 to-indigo-600' : 'bg-gradient-to-r from-purple-500 to-pink-600'} text-white`}>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-2xl">
                                                    {user.user_type === 'client' ? '💼' : '📸'}
                                                </div>
                                                <div>
                                                    <h3 className="font-bold">{user.first_name} {user.last_name || ''}</h3>
                                                    <p className="text-sm text-white/80">@{user.username || 'без username'}</p>
                                                </div>
                                            </div>
                                            {user.role === 'accountant' && (
                                                <span className="text-xs px-2 py-1 rounded-full bg-white/20">👔</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Body */}
                                    <div className="p-4 space-y-3">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-slate-500">Telegram ID</span>
                                            <span className="font-mono text-slate-700">{user.telegram_id}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-slate-500">Баланс</span>
                                            <span className="font-bold text-green-600">{user.balance?.toLocaleString() || 0} сом</span>
                                        </div>
                                        {user.influencer_profiles?.[0]?.instagram_username && (
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="text-slate-500">Instagram</span>
                                                <a
                                                    href={`https://instagram.com/${user.influencer_profiles[0].instagram_username}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-pink-600 font-medium hover:text-pink-700 hover:underline transition-colors"
                                                >
                                                    @{user.influencer_profiles[0].instagram_username}
                                                    {user.influencer_profiles[0].instagram_connected && ' ✓'}
                                                </a>
                                            </div>
                                        )}
                                        <p className="text-xs text-slate-400 pt-2 border-t">
                                            Создан: {new Date(user.created_at).toLocaleDateString('ru')}
                                        </p>
                                    </div>

                                    {/* Actions */}
                                    <div className="p-3 bg-slate-50 border-t flex flex-wrap gap-2">
                                        <button onClick={() => toggleUserType(user.id, user.user_type)}
                                            className="flex-1 text-xs px-3 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors">
                                            → {user.user_type === 'client' ? 'Инфл.' : 'Заказ.'}
                                        </button>
                                        <button onClick={() => addBalance(user.id)}
                                            className="flex-1 text-xs px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors">
                                            💰 Пополнить
                                        </button>
                                        <button onClick={() => deleteUser(user.id)}
                                            className="text-xs px-3 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors">
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {users.length === 0 && (
                                <div className="col-span-full text-center py-16 text-slate-400">
                                    <span className="text-4xl">👥</span>
                                    <p className="mt-2">Нет пользователей</p>
                                </div>
                            )}
                        </div>
                    ) : activeTab === 'tasks' ? (
                        // === Заказы ===
                        <div className="grid gap-4 sm:grid-cols-2">
                            {tasks.map(task => (
                                <div key={task.id} className="bg-white rounded-2xl border border-slate-200/50 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                                    {/* Status Header */}
                                    <div className={`px-4 py-2 text-sm font-medium flex items-center justify-between ${task.status === 'open' ? 'bg-green-50 text-green-700' :
                                        task.status === 'in_progress' ? 'bg-blue-50 text-blue-700' :
                                            task.status === 'completed' ? 'bg-slate-100 text-slate-600' : 'bg-red-50 text-red-700'
                                        }`}>
                                        <span>
                                            {task.status === 'open' ? '🟢 Открыт' :
                                                task.status === 'in_progress' ? '🔵 В работе' :
                                                    task.status === 'completed' ? '✅ Завершен' : '❌ ' + task.status}
                                        </span>
                                        <span className="text-xs opacity-70">{new Date(task.created_at).toLocaleDateString('ru')}</span>
                                    </div>

                                    {/* Content */}
                                    <div className="p-4">
                                        <h3 className="font-bold text-slate-800 mb-2">{task.title}</h3>
                                        <p className="text-sm text-slate-500 mb-4 line-clamp-2">{task.description}</p>

                                        <div className="space-y-2 text-sm">
                                            <div className="flex items-center justify-between">
                                                <span className="text-slate-500">💼 Заказчик</span>
                                                <span className="text-slate-700">{task.client?.first_name} {task.client?.last_name || ''}</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-slate-500">💰 Бюджет</span>
                                                <span className="font-bold text-green-600">{formatTaskBudget(task, { prefix: '' })}</span>
                                            </div>
                                            {task.target_metrics && (
                                                <div className="flex items-center justify-between">
                                                    <span className="text-slate-500">🎯 Цели</span>
                                                    <span className="text-slate-600">
                                                        {task.target_metrics.views && `👁${task.target_metrics.views.toLocaleString()} `}
                                                        {task.target_metrics.likes && `❤️${task.target_metrics.likes.toLocaleString()} `}
                                                        {task.target_metrics.comments && `💬${task.target_metrics.comments.toLocaleString()}`}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="p-3 bg-slate-50 border-t">
                                        <button onClick={() => deleteTask(task.id)}
                                            className="w-full text-xs px-3 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors">
                                            🗑️ Удалить заказ
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {tasks.length === 0 && (
                                <div className="col-span-full text-center py-16 text-slate-400">
                                    <span className="text-4xl">📋</span>
                                    <p className="mt-2">Нет заказов</p>
                                </div>
                            )}
                        </div>
                    ) : activeTab === 'create-task' ? (
                        // === Создать заказ ===
                        <div className="max-w-2xl mx-auto">
                            <div className="bg-white rounded-2xl border border-slate-200/50 shadow-sm overflow-hidden">
                                <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-purple-50 to-pink-50">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-2xl">
                                            ➕
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-bold text-slate-800">Создать новый заказ</h2>
                                            <p className="text-sm text-slate-500">Все поля со звёздочкой обязательны</p>
                                        </div>
                                    </div>
                                </div>

                                <form onSubmit={createTask} className="p-6 space-y-5">
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">Заказчик *</label>
                                        <select
                                            value={newTask.clientId}
                                            onChange={(e) => setNewTask({ ...newTask, clientId: e.target.value })}
                                            className="w-full p-3 border border-slate-200 rounded-xl bg-white text-gray-900 placeholder-gray-400 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all outline-none"
                                            required
                                        >
                                            <option value="">Выберите заказчика</option>
                                            {users.filter(u => u.user_type === 'client' || u.telegram_id === 7737197594).map(user => (
                                                <option key={user.id} value={user.id}>
                                                    {user.first_name} {user.last_name || ''} (@{user.username || user.telegram_id})
                                                </option>
                                            ))}
                                        </select>
                                        <p className="text-xs text-slate-400 mt-1.5">Можно выбрать себя (админа) или любого заказчика</p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">Название задания *</label>
                                        <input
                                            type="text"
                                            value={newTask.title}
                                            onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                                            className="w-full p-3 border border-slate-200 rounded-xl bg-white text-gray-900 placeholder-gray-400 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all outline-none"
                                            placeholder="Например: Реклама нового продукта"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">Описание *</label>
                                        <textarea
                                            value={newTask.description}
                                            onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                                            className="w-full p-3 border border-slate-200 rounded-xl bg-white text-gray-900 placeholder-gray-400 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all outline-none h-32 resize-none"
                                            placeholder="Подробное описание задания..."
                                            required
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        {!newTask.usePricingTiers && (
                                            <div>
                                                <label className="block text-sm font-semibold text-slate-700 mb-2">💰 Бюджет (сом) *</label>
                                                <input
                                                    type="number"
                                                    value={newTask.budget}
                                                    onChange={(e) => setNewTask({ ...newTask, budget: e.target.value })}
                                                    className="w-full p-3 border border-slate-200 rounded-xl bg-white text-gray-900 placeholder-gray-400 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all outline-none"
                                                    placeholder="5000"
                                                    min="100"
                                                    required={!newTask.usePricingTiers}
                                                />
                                            </div>
                                        )}
                                        <div className={newTask.usePricingTiers ? "col-span-2" : ""}>
                                            <label className="block text-sm font-medium mb-1">📅 Дедлайн *</label>
                                            <input
                                                type="date"
                                                value={newTask.deadline}
                                                onChange={(e) => setNewTask({ ...newTask, deadline: e.target.value })}
                                                className="w-full p-3 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-400"
                                                required
                                            />
                                        </div>
                                    </div>

                                    {/* Переключатель режима оплаты */}
                                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                                        <label className="flex items-center gap-3 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={newTask.usePricingTiers}
                                                onChange={(e) => setNewTask({ ...newTask, usePricingTiers: e.target.checked })}
                                                className="w-5 h-5"
                                            />
                                            <div>
                                                <div className="font-medium">💰 Ценовые диапазоны (лесенка)</div>
                                                <div className="text-xs text-gray-600">
                                                    Оплата зависит от количества метрик (рекомендуется для масштабирования)
                                                </div>
                                            </div>
                                        </label>
                                    </div>

                                    {/* Pricing Tiers UI */}
                                    {newTask.usePricingTiers && (
                                        <div className="space-y-3 bg-gray-50 rounded-lg p-4">
                                            <div className="flex items-center justify-between mb-2">
                                                <h3 className="font-medium">📊 Ценовые диапазоны</h3>
                                                <div className="flex gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={sortPricingTiers}
                                                        className="text-blue-600 text-sm hover:underline"
                                                    >
                                                        ↕ Сортировать
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={addNextPricingTier}
                                                        className="text-blue-600 text-sm hover:underline"
                                                    >
                                                        + Следующий порог
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={addPricingTier}
                                                        className="text-blue-600 text-sm hover:underline"
                                                    >
                                                        + Добавить
                                                    </button>
                                                </div>
                                            </div>
                                            <p className="text-xs text-gray-500 mb-3">
                                                📈 Лесенка: выплата начисляется при достижении "От". Поле "До" можно оставить пустым (∞). Цена может быть 0.
                                            </p>

                                            {pricingTiers.map((tier, index) => {
                                                const { errors } = normalizePricingTiers(pricingTiers)
                                                const rowErrors = errors?.[index] || []
                                                return (
                                                    <div key={index} className="bg-white rounded-lg p-3 border">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <span className="text-sm font-medium">Диапазон {index + 1}</span>
                                                            {pricingTiers.length > 1 && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => removePricingTier(index)}
                                                                    className="text-red-500 text-sm hover:underline"
                                                                >
                                                                    Удалить
                                                                </button>
                                                            )}
                                                        </div>

                                                        <div className="grid grid-cols-4 gap-2">
                                                            <div>
                                                                <label className="block text-xs text-gray-500 mb-1">От</label>
                                                                <input
                                                                    type="number"
                                                                    value={tier.min}
                                                                    onChange={(e) => updatePricingTier(index, 'min', e.target.value)}
                                                                    placeholder="2000"
                                                                    min="0"
                                                                    className="w-full p-2 border rounded text-sm"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="block text-xs text-gray-500 mb-1">До</label>
                                                                <input
                                                                    type="number"
                                                                    value={tier.max}
                                                                    onChange={(e) => updatePricingTier(index, 'max', e.target.value)}
                                                                    placeholder="∞"
                                                                    min="0"
                                                                    className="w-full p-2 border rounded text-sm"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="block text-xs text-gray-500 mb-1">Цена (сом)</label>
                                                                <input
                                                                    type="number"
                                                                    value={tier.price}
                                                                    onChange={(e) => updatePricingTier(index, 'price', e.target.value)}
                                                                    placeholder="2000"
                                                                    min="0"
                                                                    className="w-full p-2 border rounded text-sm"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="block text-xs text-gray-500 mb-1">Метрика</label>
                                                                <select
                                                                    value={tier.metric}
                                                                    onChange={(e) => updatePricingTier(index, 'metric', e.target.value)}
                                                                    className="w-full p-2 border rounded text-sm"
                                                                >
                                                                    <option value="views">👁 Просмотры</option>
                                                                    <option value="likes">❤️ Лайки</option>
                                                                    <option value="comments">💬 Комментарии</option>
                                                                </select>
                                                            </div>
                                                        </div>

                                                        {rowErrors.length > 0 && (
                                                            <div className="text-xs text-red-500 mt-2">
                                                                {rowErrors.map((msg, i) => (
                                                                    <div key={i}>• {msg}</div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}

                                    {/* Requirements */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium mb-1">👥 Мин. подписчиков</label>
                                            <input
                                                type="number"
                                                value={newTask.minFollowers}
                                                onChange={(e) => setNewTask({ ...newTask, minFollowers: e.target.value })}
                                                className="w-full p-3 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-400"
                                                placeholder="10000"
                                                min="0"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1">📈 Мин. вовлечённость (%)</label>
                                            <input
                                                type="number"
                                                value={newTask.minEngagementRate}
                                                onChange={(e) => setNewTask({ ...newTask, minEngagementRate: e.target.value })}
                                                className="w-full p-3 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-400"
                                                placeholder="2.5"
                                                min="0"
                                                max="100"
                                                step="0.1"
                                            />
                                        </div>
                                    </div>

                                    {!newTask.usePricingTiers && (
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
                                    )}

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium mb-1">⏱ Дней на набор метрик</label>
                                            <input
                                                type="number"
                                                value={newTask.metricDeadlineDays}
                                                onChange={(e) => setNewTask({ ...newTask, metricDeadlineDays: e.target.value })}
                                                className="w-full p-3 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-400"
                                                placeholder="7"
                                                min="1"
                                                max="90"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1">👥 Макс. инфлюенсеров</label>
                                            <input
                                                type="number"
                                                value={newTask.maxInfluencers}
                                                onChange={(e) => setNewTask({ ...newTask, maxInfluencers: e.target.value })}
                                                className="w-full p-3 border border-slate-200 rounded-xl bg-white text-gray-900 placeholder-gray-400 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all outline-none"
                                                placeholder="Без ограничений"
                                                min="1"
                                            />
                                            <p className="text-xs text-slate-400 mt-1.5">Оставьте пустым для неограниченного количества</p>
                                        </div>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-4 rounded-xl font-bold text-lg hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 transition-all shadow-lg shadow-purple-500/25"
                                    >
                                        {loading ? (
                                            <span className="flex items-center justify-center gap-2">
                                                <span className="animate-spin">⏳</span> Создание...
                                            </span>
                                        ) : '✅ Создать заказ'}
                                    </button>
                                </form>
                            </div>
                        </div>
                    ) : activeTab === 'submissions' ? (
                        // === Публикации ===
                        <div className="space-y-4">
                            {isManualMode && (
                                <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-4 flex items-center gap-3">
                                    <span className="text-2xl">✍️</span>
                                    <p className="text-sm text-orange-800">
                                        <strong>Ручной режим активен.</strong> Вы можете обновлять метрики и завершать задания вручную.
                                    </p>
                                </div>
                            )}

                            <div className="grid gap-4 sm:grid-cols-2">
                                {submissions.map(sub => (
                                    <div key={sub.id} className="bg-white rounded-2xl border border-slate-200/50 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                                        {/* Status Header */}
                                        <div className={`px-4 py-2 text-sm font-medium flex items-center justify-between ${sub.status === 'pending' ? 'bg-yellow-50 text-yellow-700' :
                                            sub.status === 'pending_approval' ? 'bg-orange-50 text-orange-700' :
                                                sub.status === 'in_progress' ? 'bg-blue-50 text-blue-700' :
                                                    sub.status === 'completed' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                                            }`}>
                                            <span>
                                                {sub.status === 'pending' ? '⏳ Ожидает' :
                                                    sub.status === 'pending_approval' ? '🔍 На проверке' :
                                                        sub.status === 'in_progress' ? '🔵 В работе' :
                                                            sub.status === 'completed' ? '✅ Завершено' : sub.status}
                                            </span>
                                            {sub.current_metrics?.manual_entry && (
                                                <span className="text-xs bg-white/50 px-2 py-0.5 rounded-full">✍️ Ручной ввод</span>
                                            )}
                                        </div>

                                        {/* Content */}
                                        <div className="p-4">
                                            <h3 className="font-bold text-slate-800 mb-2">{sub.task?.title || 'Задание удалено'}</h3>
                                            <p className="text-sm text-slate-500 mb-3">📸 {sub.influencer?.first_name} {sub.influencer?.last_name || ''}</p>

                                            <a href={sub.post_url} target="_blank" rel="noopener noreferrer"
                                                className="text-sm text-blue-600 hover:text-blue-800 break-all hover:underline block mb-4">
                                                🔗 {sub.post_url?.length > 50 ? sub.post_url.slice(0, 50) + '...' : sub.post_url}
                                            </a>

                                            {/* Метрики */}
                                            <div className="bg-slate-50 rounded-xl p-3">
                                                <p className="text-xs text-slate-500 mb-2 font-medium">📊 Текущие метрики</p>
                                                <div className="grid grid-cols-3 gap-2 text-center">
                                                    <div className="bg-white rounded-lg p-2">
                                                        <div className="text-lg font-bold text-slate-800">{sub.current_metrics?.views?.toLocaleString() || 0}</div>
                                                        <div className="text-xs text-slate-400">👁 Просмотры</div>
                                                    </div>
                                                    <div className="bg-white rounded-lg p-2">
                                                        <div className="text-lg font-bold text-slate-800">{sub.current_metrics?.likes?.toLocaleString() || 0}</div>
                                                        <div className="text-xs text-slate-400">❤️ Лайки</div>
                                                    </div>
                                                    <div className="bg-white rounded-lg p-2">
                                                        <div className="text-lg font-bold text-slate-800">{sub.current_metrics?.comments?.toLocaleString() || 0}</div>
                                                        <div className="text-xs text-slate-400">💬 Комменты</div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="p-3 bg-slate-50 border-t flex flex-wrap gap-2">
                                            {isManualMode && (
                                                <>
                                                    <button onClick={() => updateSubmissionMetrics(sub.id)}
                                                        className="flex-1 text-xs px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors">
                                                        📊 Метрики
                                                    </button>
                                                    {sub.status !== 'completed' && (
                                                        <button onClick={() => manualCompleteSubmission(sub.id)}
                                                            className="flex-1 text-xs px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors">
                                                            ✅ Завершить
                                                        </button>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {submissions.length === 0 && (
                                <div className="text-center py-16 text-slate-400">
                                    <span className="text-4xl">📝</span>
                                    <p className="mt-2">Нет публикаций</p>
                                </div>
                            )}
                        </div>
                    ) : activeTab === 'withdrawals' ? (
                        // === Выплаты ===
                        <div className="grid gap-4 sm:grid-cols-2">
                            {withdrawals.map(request => (
                                <div key={request.id} className="bg-white rounded-2xl border border-slate-200/50 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                                    {/* Status Header */}
                                    <div className={`px-4 py-2 text-sm font-medium flex items-center justify-between ${request.status === 'pending' ? 'bg-yellow-50 text-yellow-700' :
                                        request.status === 'approved' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                                        }`}>
                                        <span>
                                            {request.status === 'pending' ? '⏳ Ожидает' :
                                                request.status === 'approved' ? '✅ Одобрено' : '❌ Отклонено'}
                                        </span>
                                        <span className="text-xs opacity-70">{new Date(request.created_at).toLocaleDateString('ru')}</span>
                                    </div>

                                    {/* Content */}
                                    <div className="p-4">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-2xl">
                                                💸
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-slate-800">{request.users?.first_name} {request.users?.last_name || ''}</h3>
                                                <p className="text-sm text-slate-500">ID: {request.users?.telegram_id}</p>
                                            </div>
                                        </div>

                                        <div className="space-y-2 text-sm">
                                            <div className="flex items-center justify-between">
                                                <span className="text-slate-500">Сумма вывода</span>
                                                <span className="text-xl font-bold text-green-600">{request.amount?.toLocaleString()} сом</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-slate-500">Баланс</span>
                                                <span className="text-slate-700">{request.users?.balance?.toLocaleString()} сом</span>
                                            </div>
                                            {request.payment_method && (
                                                <div className="flex items-center justify-between">
                                                    <span className="text-slate-500">Метод</span>
                                                    <span className="text-slate-700">{request.payment_method}</span>
                                                </div>
                                            )}
                                            {request.payment_details && (
                                                <div className="flex items-center justify-between">
                                                    <span className="text-slate-500">Реквизиты</span>
                                                    <span className="text-slate-700 font-mono text-xs">{request.payment_details}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    {request.status === 'pending' && (
                                        <div className="p-3 bg-slate-50 border-t flex gap-2">
                                            <button onClick={() => processWithdrawal(request.id, 'approved')}
                                                className="flex-1 text-xs px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium">
                                                ✅ Одобрить
                                            </button>
                                            <button onClick={() => processWithdrawal(request.id, 'rejected')}
                                                className="flex-1 text-xs px-3 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors">
                                                ❌ Отклонить
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}

                            {withdrawals.length === 0 && (
                                <div className="col-span-full text-center py-16 text-slate-400">
                                    <span className="text-4xl">💸</span>
                                    <p className="mt-2">Нет заявок на вывод</p>
                                </div>
                            )}
                        </div>
                    ) : activeTab === 'stats' ? (
                        // === Статистика ===
                        stats ? (
                            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                                {/* Пользователи */}
                                <div className="bg-white rounded-2xl border border-slate-200/50 shadow-sm overflow-hidden">
                                    <div className="p-4 border-b border-slate-100 bg-gradient-to-r from-purple-50 to-pink-50">
                                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                            <span className="text-xl">👥</span> Пользователи
                                        </h3>
                                    </div>
                                    <div className="p-4">
                                        <div className="grid grid-cols-3 gap-3 text-center">
                                            <div className="bg-slate-50 rounded-xl p-3">
                                                <div className="text-2xl font-bold text-purple-600">{stats.total_users}</div>
                                                <div className="text-xs text-slate-500">Всего</div>
                                            </div>
                                            <div className="bg-slate-50 rounded-xl p-3">
                                                <div className="text-2xl font-bold text-blue-500">{stats.clients}</div>
                                                <div className="text-xs text-slate-500">Заказчики</div>
                                            </div>
                                            <div className="bg-slate-50 rounded-xl p-3">
                                                <div className="text-2xl font-bold text-pink-500">{stats.influencers}</div>
                                                <div className="text-xs text-slate-500">Инфлюенсеры</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Заказы */}
                                <div className="bg-white rounded-2xl border border-slate-200/50 shadow-sm overflow-hidden">
                                    <div className="p-4 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-indigo-50">
                                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                            <span className="text-xl">📋</span> Заказы
                                        </h3>
                                    </div>
                                    <div className="p-4">
                                        <div className="grid grid-cols-3 gap-3 text-center">
                                            <div className="bg-slate-50 rounded-xl p-3">
                                                <div className="text-2xl font-bold text-purple-600">{stats.tasks}</div>
                                                <div className="text-xs text-slate-500">Всего</div>
                                            </div>
                                            <div className="bg-slate-50 rounded-xl p-3">
                                                <div className="text-2xl font-bold text-blue-500">{stats.active_tasks}</div>
                                                <div className="text-xs text-slate-500">Активных</div>
                                            </div>
                                            <div className="bg-slate-50 rounded-xl p-3">
                                                <div className="text-2xl font-bold text-green-500">{stats.completed_tasks}</div>
                                                <div className="text-xs text-slate-500">Завершено</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Финансы */}
                                <div className="bg-white rounded-2xl border border-slate-200/50 shadow-sm overflow-hidden sm:col-span-2 lg:col-span-1">
                                    <div className="p-4 border-b border-slate-100 bg-gradient-to-r from-green-50 to-emerald-50">
                                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                            <span className="text-xl">💰</span> Финансы
                                        </h3>
                                    </div>
                                    <div className="p-4 space-y-3">
                                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                                            <span className="text-slate-500">Транзакций</span>
                                            <span className="font-bold text-slate-800">{stats.transactions}</span>
                                        </div>
                                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                                            <span className="text-slate-500">Оборот</span>
                                            <span className="font-bold text-green-600">{stats.revenue?.toLocaleString()} сом</span>
                                        </div>
                                        <div className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-100 to-pink-100 rounded-xl">
                                            <span className="text-purple-700">На платформе</span>
                                            <span className="font-bold text-purple-700">{stats.platform_balance?.toLocaleString()} сом</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-64">
                                <div className="text-center">
                                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent mx-auto mb-4"></div>
                                    <p className="text-slate-500">Загрузка статистики...</p>
                                </div>
                            </div>
                        )
                    ) : null}
                </main>
            </div>
        </div>
    )
}

export default WebAdminSettings
