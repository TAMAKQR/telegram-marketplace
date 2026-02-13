import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Logo from '../components/Logo'
import { formatTaskBudget } from '../lib/taskBudget'

function WebClientDashboard() {
    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [loginMethod, setLoginMethod] = useState('telegram') // telegram or phone
    const [telegramId, setTelegramId] = useState('')
    const [phone, setPhone] = useState('')
    const [authError, setAuthError] = useState('')

    const [loading, setLoading] = useState(false)
    const [activeTab, setActiveTab] = useState('tasks')
    const [profile, setProfile] = useState(null)

    // Данные
    const [tasks, setTasks] = useState([])
    const [submissions, setSubmissions] = useState([])

    // Форма создания заказа
    const [showCreateForm, setShowCreateForm] = useState(false)
    const [newTask, setNewTask] = useState({
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

    // Проверяем сохранённую сессию
    useEffect(() => {
        const savedProfile = sessionStorage.getItem('webClientProfile')
        if (savedProfile) {
            const parsed = JSON.parse(savedProfile)
            setProfile(parsed)
            setIsAuthenticated(true)
        }
    }, [])

    // Загрузка данных
    useEffect(() => {
        if (!isAuthenticated || !profile) return
        if (activeTab === 'tasks') loadTasks()
        else if (activeTab === 'submissions') loadSubmissions()
    }, [isAuthenticated, profile, activeTab])

    const handleLogin = async (e) => {
        e.preventDefault()
        setAuthError('')
        setLoading(true)

        try {
            let query = supabase.from('users').select('*')

            if (loginMethod === 'telegram') {
                if (!telegramId) {
                    setAuthError('Введите Telegram ID')
                    setLoading(false)
                    return
                }
                query = query.eq('telegram_id', parseInt(telegramId))
            } else {
                if (!phone) {
                    setAuthError('Введите номер телефона')
                    setLoading(false)
                    return
                }
                query = query.eq('phone', phone.replace(/\D/g, ''))
            }

            const { data, error } = await query.maybeSingle()

            if (error) throw error

            if (!data) {
                setAuthError('Пользователь не найден. Сначала зарегистрируйтесь через Telegram бота.')
                setLoading(false)
                return
            }

            if (data.user_type !== 'client') {
                setAuthError('Этот аккаунт не является заказчиком')
                setLoading(false)
                return
            }

            setProfile(data)
            setIsAuthenticated(true)
            sessionStorage.setItem('webClientProfile', JSON.stringify(data))
        } catch (error) {
            console.error('Ошибка:', error)
            setAuthError('Ошибка входа: ' + error.message)
        } finally {
            setLoading(false)
        }
    }

    const handleLogout = () => {
        setIsAuthenticated(false)
        setProfile(null)
        sessionStorage.removeItem('webClientProfile')
        setTelegramId('')
        setPhone('')
    }

    const loadTasks = async () => {
        if (!profile) return
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('tasks')
                .select(`
                    *, 
                    influencer:influencer_id(id, first_name, last_name, telegram_id)
                `)
                .eq('client_id', profile.id)
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
        if (!profile) return
        setLoading(true)
        try {
            // Загрузим submissions для задач этого клиента
            const { data: tasksData } = await supabase
                .from('tasks')
                .select('id')
                .eq('client_id', profile.id)

            const taskIds = tasksData?.map(t => t.id) || []

            if (taskIds.length === 0) {
                setSubmissions([])
                setLoading(false)
                return
            }

            const { data, error } = await supabase
                .from('task_submissions')
                .select(`
                    *,
                    task:task_id(id, title, target_metrics, budget),
                    influencer:influencer_id(id, first_name, last_name, telegram_id)
                `)
                .in('task_id', taskIds)
                .order('created_at', { ascending: false })

            if (error) throw error
            setSubmissions(data || [])
        } catch (error) {
            console.error('Ошибка загрузки публикаций:', error)
        } finally {
            setLoading(false)
        }
    }

    // Создание заказа
    const createTask = async (e) => {
        e.preventDefault()

        // Базовая валидация
        if (!newTask.title || !newTask.description || !newTask.deadline) {
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

            // Преобразуем deadline в ISO формат
            const deadlineDate = new Date(newTask.deadline)
            deadlineDate.setHours(23, 59, 59, 0)
            const deadlineISO = deadlineDate.toISOString()

            const taskData = {
                client_id: profile.id,
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

            console.log('Creating task:', taskData)

            const { data, error } = await supabase
                .from('tasks')
                .insert([taskData])
                .select()
                .single()

            console.log('Create result:', { data, error })

            if (error) throw error

            alert('Заказ успешно создан!')
            setNewTask({
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
            setShowCreateForm(false)
            loadTasks()
        } catch (error) {
            console.error('Ошибка:', error)
            alert('Ошибка при создании заказа: ' + error.message)
        } finally {
            setLoading(false)
        }
    }

    // Одобрение/отклонение публикации
    const approveSubmission = async (submissionId, approved) => {
        if (!approved) {
            const reason = prompt('Причина отклонения:')
            if (!reason) return
        }
        setLoading(true)
        try {
            const { error } = await supabase.rpc('approve_submission', {
                p_submission_id: submissionId,
                p_client_id: profile.id,
                p_approved: approved,
                p_rejection_reason: approved ? null : 'Отклонено заказчиком'
            })
            if (error) throw error
            alert(approved ? 'Публикация одобрена!' : 'Публикация отклонена')
            loadSubmissions()
        } catch (error) {
            console.error('Ошибка:', error)
            alert('Ошибка: ' + error.message)
        } finally {
            setLoading(false)
        }
    }

    // Форма авторизации
    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
                    <div className="text-center mb-8">
                        <Logo className="h-12 mx-auto mb-4" />
                        <h1 className="text-2xl font-bold text-gray-800">💼 Кабинет заказчика</h1>
                        <p className="text-gray-500 mt-2">Вход через Telegram ID</p>
                    </div>

                    <div className="flex gap-2 mb-6">
                        <button
                            onClick={() => setLoginMethod('telegram')}
                            className={`flex-1 py-2 rounded-lg font-medium ${loginMethod === 'telegram' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}
                        >
                            Telegram ID
                        </button>
                        <button
                            onClick={() => setLoginMethod('phone')}
                            className={`flex-1 py-2 rounded-lg font-medium ${loginMethod === 'phone' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}
                        >
                            Телефон
                        </button>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-4">
                        {loginMethod === 'telegram' ? (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Telegram ID</label>
                                <input
                                    type="number"
                                    value={telegramId}
                                    onChange={(e) => setTelegramId(e.target.value)}
                                    className="w-full p-3 border border-gray-300 rounded-lg"
                                    placeholder="Например: 123456789"
                                    required
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Узнать свой ID можно у бота @userinfobot
                                </p>
                            </div>
                        ) : (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Номер телефона</label>
                                <input
                                    type="tel"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    className="w-full p-3 border border-gray-300 rounded-lg"
                                    placeholder="+7 999 123 45 67"
                                    required
                                />
                            </div>
                        )}

                        {authError && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{authError}</div>}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
                        >
                            {loading ? 'Вход...' : 'Войти'}
                        </button>
                    </form>

                    <p className="text-center text-sm text-gray-500 mt-6">
                        Нет аккаунта? Зарегистрируйтесь через <a href="https://t.me/your_bot" className="text-blue-600 hover:underline">Telegram бота</a>
                    </p>
                </div>
            </div>
        )
    }

    // Кабинет заказчика
    return (
        <div className="min-h-screen bg-gray-100">
            {/* Header */}
            <header className="bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg">
                <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Logo className="h-8" />
                        <div>
                            <h1 className="text-lg font-bold">💼 Кабинет заказчика</h1>
                            <p className="text-xs text-white/80">{profile?.first_name} {profile?.last_name || ''}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-sm bg-white/20 px-3 py-1 rounded-full">
                            💰 {profile?.balance?.toLocaleString() || 0} сом
                        </span>
                        <button onClick={handleLogout} className="text-white/80 hover:text-white px-3 py-1 hover:bg-white/10 rounded-lg">
                            Выйти
                        </button>
                    </div>
                </div>
            </header>

            {/* Tabs */}
            <div className="bg-white shadow-sm">
                <div className="max-w-4xl mx-auto px-4">
                    <div className="flex gap-2 py-2">
                        <button
                            onClick={() => setActiveTab('tasks')}
                            className={`px-4 py-2 rounded-lg font-medium ${activeTab === 'tasks' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                        >
                            📋 Мои заказы ({tasks.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('submissions')}
                            className={`px-4 py-2 rounded-lg font-medium ${activeTab === 'submissions' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                        >
                            📝 На проверке ({submissions.filter(s => s.status === 'pending').length})
                        </button>
                        <button
                            onClick={() => setShowCreateForm(true)}
                            className="ml-auto px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700"
                        >
                            ➕ Новый заказ
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <main className="max-w-4xl mx-auto p-4 mt-4">
                {loading ? (
                    <div className="text-center py-20 text-gray-500">Загрузка...</div>
                ) : activeTab === 'tasks' ? (
                    // === Мои заказы ===
                    <div className="space-y-3">
                        {tasks.map(task => (
                            <div key={task.id} className="bg-white rounded-xl p-4 shadow-sm">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex-1">
                                        <h3 className="font-semibold mb-1">{task.title}</h3>
                                        <p className="text-sm text-gray-500 mb-2">{task.description?.slice(0, 150)}...</p>
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
                                                task.status === 'completed' ? '✅ Завершен' : task.status}
                                    </span>
                                </div>
                                <p className="text-xs text-gray-400">
                                    Создан: {new Date(task.created_at).toLocaleDateString('ru')}
                                    {task.deadline && ` • Дедлайн: ${new Date(task.deadline).toLocaleDateString('ru')}`}
                                </p>
                            </div>
                        ))}
                        {tasks.length === 0 && (
                            <div className="text-center py-10">
                                <p className="text-gray-500 mb-4">У вас пока нет заказов</p>
                                <button
                                    onClick={() => setShowCreateForm(true)}
                                    className="bg-green-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-green-700"
                                >
                                    ➕ Создать первый заказ
                                </button>
                            </div>
                        )}
                    </div>
                ) : activeTab === 'submissions' ? (
                    // === Публикации на проверке ===
                    <div className="space-y-3">
                        {submissions.map(sub => (
                            <div key={sub.id} className="bg-white rounded-xl p-4 shadow-sm">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex-1">
                                        <h3 className="font-semibold mb-1">{sub.task?.title || 'Задание'}</h3>
                                        <p className="text-sm">📸 Инфлюенсер: {sub.influencer?.first_name} {sub.influencer?.last_name || ''}</p>
                                        <p className="text-sm text-blue-600 break-all">
                                            🔗 <a href={sub.post_url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                                {sub.post_url}
                                            </a>
                                        </p>
                                    </div>
                                    <span className={`text-xs px-2 py-1 rounded-full ${sub.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                        sub.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                                            sub.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                        }`}>
                                        {sub.status === 'pending' ? '⏳ Ожидает' :
                                            sub.status === 'in_progress' ? '🔵 В работе' :
                                                sub.status === 'completed' ? '✅ Завершено' : sub.status}
                                    </span>
                                </div>

                                {/* Метрики */}
                                {sub.current_metrics && (
                                    <div className="bg-gray-50 rounded-lg p-3 mb-3">
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
                                    </div>
                                )}

                                {sub.status === 'pending' && (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => approveSubmission(sub.id, true)}
                                            className="flex-1 bg-green-500 text-white py-2 rounded-lg hover:bg-green-600 font-medium"
                                        >
                                            ✅ Одобрить
                                        </button>
                                        <button
                                            onClick={() => approveSubmission(sub.id, false)}
                                            className="flex-1 bg-red-500 text-white py-2 rounded-lg hover:bg-red-600 font-medium"
                                        >
                                            ❌ Отклонить
                                        </button>
                                    </div>
                                )}

                                <p className="text-xs text-gray-400 mt-2">
                                    Отправлено: {new Date(sub.submitted_at || sub.created_at).toLocaleString('ru')}
                                </p>
                            </div>
                        ))}
                        {submissions.length === 0 && <p className="text-center py-10 text-gray-500">Нет публикаций на проверке</p>}
                    </div>
                ) : null}
            </main>

            {/* Модалка создания заказа */}
            {showCreateForm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-semibold">➕ Новый заказ</h2>
                            <button onClick={() => setShowCreateForm(false)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
                        </div>

                        <form onSubmit={createTask} className="space-y-4">
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
                                    className="w-full p-3 border border-gray-300 rounded-lg h-24"
                                    placeholder="Подробное описание задания..."
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {!newTask.usePricingTiers && (
                                    <div>
                                        <label className="block text-sm font-medium mb-1">💰 Бюджет (сом) *</label>
                                        <input
                                            type="number"
                                            value={newTask.budget}
                                            onChange={(e) => setNewTask({ ...newTask, budget: e.target.value })}
                                            className="w-full p-3 border border-gray-300 rounded-lg"
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
                                        className="w-full p-3 border border-gray-300 rounded-lg"
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
                                        className="w-full p-3 border border-gray-300 rounded-lg"
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
                                        className="w-full p-3 border border-gray-300 rounded-lg"
                                        placeholder="2.5"
                                        min="0"
                                        max="100"
                                        step="0.1"
                                    />
                                </div>
                            </div>

                            {!newTask.usePricingTiers && (
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <h3 className="font-medium mb-3">🎯 Целевые метрики</h3>
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
                                        className="w-full p-3 border border-gray-300 rounded-lg"
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
                                        className="w-full p-3 border border-gray-300 rounded-lg"
                                        placeholder="Без ограничений"
                                        min="1"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Оставьте пустым для неограниченного количества</p>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50"
                            >
                                {loading ? 'Создание...' : '✅ Создать заказ'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            <footer className="text-center py-6 text-sm text-gray-400">
                Telegram Influencer Marketplace • Кабинет заказчика
            </footer>
        </div>
    )
}

export default WebClientDashboard
