import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Logo from '../components/Logo'
import { formatTaskBudget } from '../lib/taskBudget'
import { sendTelegramNotification, formatNewTaskMessage } from '../lib/telegramBot'
import {
    BackpackIcon,
    FileTextIcon,
    CheckCircledIcon,
    PlusIcon,
    Cross2Icon,
    ArrowLeftIcon,
    LockClosedIcon,
    CalendarIcon,
    ClockIcon,
    PersonIcon,
    EyeOpenIcon,
    HeartIcon,
    ChatBubbleIcon,
    CheckIcon,
    CrossCircledIcon,
    CameraIcon,
    RocketIcon,
    TargetIcon,
    BarChartIcon
} from '@radix-ui/react-icons'

function WebClientDashboard() {
    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState('tasks')
    const [profile, setProfile] = useState(null)
    const [accessDenied, setAccessDenied] = useState(false)

    // Данные
    const [tasks, setTasks] = useState([])
    const [submissions, setSubmissions] = useState([])
    const [selectedTask, setSelectedTask] = useState(null)

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

    // Проверяем client_id из URL параметров
    useEffect(() => {
        const loadClientProfile = async () => {
            const params = new URLSearchParams(window.location.search)
            const clientId = params.get('client_id')

            if (!clientId) {
                setAccessDenied(true)
                setLoading(false)
                return
            }

            try {
                const { data, error } = await supabase
                    .from('users')
                    .select('*')
                    .eq('id', clientId)
                    .eq('user_type', 'client')
                    .maybeSingle()

                if (error) throw error

                if (!data) {
                    setAccessDenied(true)
                    setLoading(false)
                    return
                }

                setProfile(data)
                setIsAuthenticated(true)
            } catch (error) {
                console.error('Ошибка загрузки профиля:', error)
                setAccessDenied(true)
            } finally {
                setLoading(false)
            }
        }

        loadClientProfile()
    }, [])

    // Загрузка данных
    useEffect(() => {
        if (!isAuthenticated || !profile) return
        if (activeTab === 'tasks') loadTasks()
        else if (activeTab === 'submissions') loadSubmissions()
    }, [isAuthenticated, profile, activeTab])

    const handleLogout = () => {
        window.location.href = '/web-admin'
    }

    const loadTasks = async () => {
        if (!profile) return
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('tasks')
                .select('*')
                .eq('client_id', profile.id)
                .order('created_at', { ascending: false })
            console.log('loadTasks result:', { data, error, profileId: profile.id })
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
                    task:task_id(id, title, target_metrics, budget)
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

            // Отправляем уведомление в канал
            try {
                const clientName = profile ? `${profile.first_name} ${profile.last_name || ''}`.trim() : 'Заказчик'
                const message = formatNewTaskMessage(data, clientName)
                await sendTelegramNotification(message)
            } catch (notifyError) {
                console.warn('Не удалось отправить уведомление:', notifyError)
            }

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

    // Экран загрузки
    if (loading && !isAuthenticated) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-purple-50 flex items-center justify-center p-4">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
                    <p className="text-slate-600">Загрузка...</p>
                </div>
            </div>
        )
    }

    // Доступ закрыт
    if (accessDenied || !isAuthenticated) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-purple-50 flex items-center justify-center p-4">
                <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl p-8 w-full max-w-md border border-white/50 text-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-red-400 to-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                        <LockClosedIcon className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800 mb-2">
                        Доступ закрыт
                    </h1>
                    <p className="text-slate-500 mb-6">
                        Кабинет заказчика доступен только через админ-панель
                    </p>
                    <a
                        href="/web-admin"
                        className="inline-block bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg hover:scale-[1.02] transition-all"
                    >
                        Перейти в админку
                    </a>
                </div>
            </div>
        )
    }

    // Кабинет заказчика
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-purple-50">
            {/* Header */}
            <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/50 sticky top-0 z-40">
                <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                            <BackpackIcon className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-slate-800">Кабинет заказчика</h1>
                            <p className="text-xs text-slate-500">{profile?.first_name} {profile?.last_name || ''}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-sm bg-gradient-to-r from-blue-500 to-purple-600 text-white px-4 py-1.5 rounded-full font-medium shadow-sm flex items-center gap-1.5">
                            <span className="text-xs">₽</span> {profile?.balance?.toLocaleString() || 0} сом
                        </span>
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-1.5 text-slate-500 hover:text-slate-700 px-3 py-1.5 hover:bg-slate-100 rounded-xl transition-colors"
                        >
                            <ArrowLeftIcon className="w-4 h-4" /> Назад
                        </button>
                    </div>
                </div>
            </header>

            {/* Tabs */}
            <div className="bg-white/60 backdrop-blur-sm border-b border-slate-200/50">
                <div className="max-w-5xl mx-auto px-4">
                    <div className="flex items-center gap-2 py-3 overflow-x-auto">
                        <button
                            onClick={() => setActiveTab('tasks')}
                            className={`px-5 py-2.5 rounded-xl font-medium transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'tasks'
                                ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md'
                                : 'text-slate-600 hover:bg-white hover:shadow-sm'
                                }`}
                        >
                            <FileTextIcon className="w-4 h-4" /> Мои заказы ({tasks.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('submissions')}
                            className={`px-5 py-2.5 rounded-xl font-medium transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'submissions'
                                ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md'
                                : 'text-slate-600 hover:bg-white hover:shadow-sm'
                                }`}
                        >
                            <CheckCircledIcon className="w-4 h-4" /> На проверке ({submissions.filter(s => s.status === 'pending').length})
                        </button>
                        <button
                            onClick={() => setShowCreateForm(true)}
                            className="ml-auto px-5 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-medium hover:shadow-lg hover:scale-[1.02] transition-all flex items-center gap-2"
                        >
                            <PlusIcon className="w-4 h-4" /> Новый заказ
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <main className="max-w-5xl mx-auto p-4 mt-4">
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="text-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
                            <p className="text-slate-500">Загрузка...</p>
                        </div>
                    </div>
                ) : activeTab === 'tasks' ? (
                    // === Мои заказы ===
                    <div className="grid gap-4 sm:grid-cols-2">
                        {tasks.map(task => (
                            <div
                                key={task.id}
                                className="bg-white rounded-2xl border border-slate-200/50 shadow-sm hover:shadow-md transition-shadow overflow-hidden cursor-pointer"
                                onClick={() => setSelectedTask(task)}
                            >
                                <div className={`px-4 py-3 border-b ${task.status === 'open' ? 'bg-gradient-to-r from-green-50 to-emerald-50' :
                                    task.status === 'in_progress' ? 'bg-gradient-to-r from-blue-50 to-indigo-50' :
                                        task.status === 'completed' ? 'bg-gradient-to-r from-slate-50 to-slate-100' :
                                            'bg-gradient-to-r from-red-50 to-orange-50'
                                    }`}>
                                    <div className="flex items-center justify-between">
                                        <h3 className="font-bold text-slate-800 truncate flex-1 mr-2">{task.title}</h3>
                                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium whitespace-nowrap ${task.status === 'open' ? 'bg-green-100 text-green-700' :
                                            task.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                                                task.status === 'completed' ? 'bg-slate-200 text-slate-600' : 'bg-red-100 text-red-700'
                                            }`}>
                                            {task.status === 'open' ? 'Активен' :
                                                task.status === 'in_progress' ? 'В работе' :
                                                    task.status === 'completed' ? 'Завершен' : task.status}
                                        </span>
                                    </div>
                                </div>
                                <div className="p-4 space-y-3">
                                    <p className="text-sm text-slate-600 line-clamp-2">{task.description?.slice(0, 150)}...</p>

                                    {task.influencer && (
                                        <div className="flex items-center gap-2 text-sm text-slate-700">
                                            <span className="w-6 h-6 bg-pink-100 rounded-full flex items-center justify-center"><CameraIcon className="w-3 h-3 text-pink-600" /></span>
                                            {task.influencer.first_name} {task.influencer.last_name || ''}
                                        </div>
                                    )}

                                    <div className="flex flex-wrap gap-2">
                                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-lg">
                                            {formatTaskBudget(task, { prefix: '' })}
                                        </span>
                                        {task.target_metrics && (
                                            <>
                                                {task.target_metrics.views && (
                                                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-lg flex items-center gap-1">
                                                        <EyeOpenIcon className="w-3 h-3" /> {task.target_metrics.views.toLocaleString()}
                                                    </span>
                                                )}
                                                {task.target_metrics.likes && (
                                                    <span className="text-xs bg-pink-100 text-pink-700 px-2 py-1 rounded-lg flex items-center gap-1">
                                                        <HeartIcon className="w-3 h-3" /> {task.target_metrics.likes.toLocaleString()}
                                                    </span>
                                                )}
                                                {task.target_metrics.comments && (
                                                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-lg flex items-center gap-1">
                                                        <ChatBubbleIcon className="w-3 h-3" /> {task.target_metrics.comments.toLocaleString()}
                                                    </span>
                                                )}
                                            </>
                                        )}
                                    </div>

                                    <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-100">
                                        <span className="flex items-center gap-1"><CalendarIcon className="w-3 h-3" /> {new Date(task.created_at).toLocaleDateString('ru')}</span>
                                        {task.deadline && (
                                            <span className="flex items-center gap-1"><ClockIcon className="w-3 h-3" /> до {new Date(task.deadline).toLocaleDateString('ru')}</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                        {tasks.length === 0 && (
                            <div className="col-span-full text-center py-16">
                                <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                    <FileTextIcon className="w-8 h-8 text-slate-400" />
                                </div>
                                <p className="text-slate-500 mb-4">У вас пока нет заказов</p>
                                <button
                                    onClick={() => setShowCreateForm(true)}
                                    className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-3 rounded-xl font-medium hover:shadow-lg hover:scale-[1.02] transition-all flex items-center gap-2 mx-auto"
                                >
                                    <PlusIcon className="w-4 h-4" /> Создать первый заказ
                                </button>
                            </div>
                        )}
                    </div>
                ) : activeTab === 'submissions' ? (
                    // === Публикации на проверке ===
                    <div className="grid gap-4 sm:grid-cols-2">
                        {submissions.map(sub => (
                            <div key={sub.id} className="bg-white rounded-2xl border border-slate-200/50 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                                <div className={`px-4 py-3 border-b ${sub.status === 'pending' ? 'bg-gradient-to-r from-amber-50 to-yellow-50' :
                                    sub.status === 'in_progress' ? 'bg-gradient-to-r from-blue-50 to-indigo-50' :
                                        sub.status === 'completed' ? 'bg-gradient-to-r from-green-50 to-emerald-50' :
                                            'bg-gradient-to-r from-red-50 to-orange-50'
                                    }`}>
                                    <div className="flex items-center justify-between">
                                        <h3 className="font-bold text-slate-800 truncate flex-1 mr-2">{sub.task?.title || 'Задание'}</h3>
                                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${sub.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                                            sub.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                                                sub.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                            }`}>
                                            {sub.status === 'pending' ? 'Ожидает' :
                                                sub.status === 'in_progress' ? 'В работе' :
                                                    sub.status === 'completed' ? 'Завершено' : sub.status}
                                        </span>
                                    </div>
                                </div>
                                <div className="p-4 space-y-3">
                                    <div className="flex items-center gap-2 text-sm text-slate-700">
                                        <span className="w-6 h-6 bg-pink-100 rounded-full flex items-center justify-center"><CameraIcon className="w-3 h-3 text-pink-600" /></span>
                                        {sub.influencer?.first_name} {sub.influencer?.last_name || ''}
                                    </div>

                                    <a
                                        href={sub.post_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sm text-blue-600 hover:underline break-all flex items-center gap-1"
                                    >
                                        <RocketIcon className="w-3 h-3 flex-shrink-0" /> {sub.post_url?.slice(0, 40)}...
                                    </a>

                                    {/* Метрики */}
                                    {sub.current_metrics && (
                                        <div className="grid grid-cols-3 gap-2">
                                            <div className="bg-slate-50 rounded-xl p-2 text-center">
                                                <div className="text-lg font-bold text-slate-800">{sub.current_metrics?.views?.toLocaleString() || 0}</div>
                                                <div className="text-xs text-slate-500 flex items-center justify-center gap-1"><EyeOpenIcon className="w-3 h-3" /> Просм.</div>
                                            </div>
                                            <div className="bg-slate-50 rounded-xl p-2 text-center">
                                                <div className="text-lg font-bold text-slate-800">{sub.current_metrics?.likes?.toLocaleString() || 0}</div>
                                                <div className="text-xs text-slate-500 flex items-center justify-center gap-1"><HeartIcon className="w-3 h-3" /> Лайки</div>
                                            </div>
                                            <div className="bg-slate-50 rounded-xl p-2 text-center">
                                                <div className="text-lg font-bold text-slate-800">{sub.current_metrics?.comments?.toLocaleString() || 0}</div>
                                                <div className="text-xs text-slate-500 flex items-center justify-center gap-1"><ChatBubbleIcon className="w-3 h-3" /> Комм.</div>
                                            </div>
                                        </div>
                                    )}

                                    {sub.status === 'pending' && (
                                        <div className="flex gap-2 pt-2">
                                            <button
                                                onClick={() => approveSubmission(sub.id, true)}
                                                className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white py-2.5 rounded-xl hover:shadow-md transition-all font-medium flex items-center justify-center gap-1"
                                            >
                                                <CheckCircledIcon className="w-4 h-4" /> Одобрить
                                            </button>
                                            <button
                                                onClick={() => approveSubmission(sub.id, false)}
                                                className="flex-1 bg-gradient-to-r from-red-500 to-rose-600 text-white py-2.5 rounded-xl hover:shadow-md transition-all font-medium flex items-center justify-center gap-1"
                                            >
                                                <CrossCircledIcon className="w-4 h-4" /> Отклонить
                                            </button>
                                        </div>
                                    )}

                                    <p className="text-xs text-slate-400 pt-2 border-t border-slate-100 flex items-center gap-1">
                                        <CalendarIcon className="w-3 h-3" /> {new Date(sub.submitted_at || sub.created_at).toLocaleString('ru')}
                                    </p>
                                </div>
                            </div>
                        ))}
                        {submissions.length === 0 && (
                            <div className="col-span-full text-center py-16 text-slate-400">
                                <CheckCircledIcon className="w-12 h-12 mx-auto text-slate-300" />
                                <p className="mt-2">Нет публикаций на проверке</p>
                            </div>
                        )}
                    </div>
                ) : null}
            </main>

            {/* Модалка создания заказа */}
            {showCreateForm && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center text-white">
                                    <PlusIcon className="w-5 h-5" />
                                </div>
                                <h2 className="text-xl font-bold text-slate-800">Новый заказ</h2>
                            </div>
                            <button
                                onClick={() => setShowCreateForm(false)}
                                className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
                            >
                                <Cross2Icon className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={createTask} className="space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Название задания *</label>
                                <input
                                    type="text"
                                    value={newTask.title}
                                    onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                                    className="w-full p-3.5 border border-slate-200 rounded-xl bg-white text-gray-900 placeholder-gray-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all outline-none"
                                    placeholder="Например: Реклама нового продукта"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Описание *</label>
                                <textarea
                                    value={newTask.description}
                                    onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                                    className="w-full p-3.5 border border-slate-200 rounded-xl bg-white text-gray-900 placeholder-gray-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all outline-none h-28 resize-none"
                                    placeholder="Подробное описание задания..."
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {!newTask.usePricingTiers && (
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">Бюджет (сом) *</label>
                                        <input
                                            type="number"
                                            value={newTask.budget}
                                            onChange={(e) => setNewTask({ ...newTask, budget: e.target.value })}
                                            className="w-full p-3.5 border border-slate-200 rounded-xl bg-white text-gray-900 placeholder-gray-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all outline-none"
                                            placeholder="5000"
                                            min="100"
                                            required={!newTask.usePricingTiers}
                                        />
                                    </div>
                                )}
                                <div className={newTask.usePricingTiers ? "col-span-2" : ""}>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Дедлайн *</label>
                                    <input
                                        type="date"
                                        value={newTask.deadline}
                                        onChange={(e) => setNewTask({ ...newTask, deadline: e.target.value })}
                                        className="w-full p-3.5 border border-slate-200 rounded-xl bg-white text-gray-900 placeholder-gray-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all outline-none"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Переключатель режима оплаты */}
                            <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-5 border border-blue-100">
                                <label className="flex items-center gap-4 cursor-pointer">
                                    <div className="relative">
                                        <input
                                            type="checkbox"
                                            checked={newTask.usePricingTiers}
                                            onChange={(e) => setNewTask({ ...newTask, usePricingTiers: e.target.checked })}
                                            className="sr-only"
                                        />
                                        <div className={`w-12 h-7 rounded-full transition-colors ${newTask.usePricingTiers ? 'bg-gradient-to-r from-blue-600 to-purple-600' : 'bg-slate-300'}`}>
                                            <div className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow-sm transition-transform ${newTask.usePricingTiers ? 'translate-x-5' : ''}`}></div>
                                        </div>
                                    </div>
                                    <div>
                                        <div className="font-semibold text-slate-800">Ценовые диапазоны (лесенка)</div>
                                        <div className="text-sm text-slate-500">
                                            Оплата зависит от количества метрик
                                        </div>
                                    </div>
                                </label>
                            </div>

                            {/* Pricing Tiers UI */}
                            {newTask.usePricingTiers && (
                                <div className="space-y-4 bg-slate-50 rounded-2xl p-5 border border-slate-200">
                                    <div className="flex items-center justify-between">
                                        <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                                            <BarChartIcon className="w-4 h-4" /> Ценовые диапазоны
                                        </h3>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={sortPricingTiers}
                                                className="text-blue-600 text-sm hover:underline font-medium"
                                            >
                                                ↕ Сорт.
                                            </button>
                                            <button
                                                type="button"
                                                onClick={addNextPricingTier}
                                                className="text-blue-600 text-sm hover:underline font-medium"
                                            >
                                                + След.
                                            </button>
                                            <button
                                                type="button"
                                                onClick={addPricingTier}
                                                className="text-blue-600 text-sm hover:underline font-medium"
                                            >
                                                + Добавить
                                            </button>
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-500">
                                        📈 Лесенка: выплата при достижении "От". "До" можно оставить пустым (∞).
                                    </p>

                                    {pricingTiers.map((tier, index) => {
                                        const { errors } = normalizePricingTiers(pricingTiers)
                                        const rowErrors = errors?.[index] || []
                                        return (
                                            <div key={index} className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                                                <div className="flex items-center justify-between mb-3">
                                                    <span className="text-sm font-semibold text-slate-700">Порог {index + 1}</span>
                                                    {pricingTiers.length > 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => removePricingTier(index)}
                                                            className="text-red-500 text-sm hover:underline font-medium"
                                                        >
                                                            Удалить
                                                        </button>
                                                    )}
                                                </div>

                                                <div className="grid grid-cols-4 gap-3">
                                                    <div>
                                                        <label className="block text-xs text-slate-500 mb-1">От</label>
                                                        <input
                                                            type="number"
                                                            value={tier.min}
                                                            onChange={(e) => updatePricingTier(index, 'min', e.target.value)}
                                                            placeholder="2000"
                                                            min="0"
                                                            className="w-full p-2.5 border border-slate-200 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:border-blue-400 text-sm transition-all outline-none"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs text-slate-500 mb-1">До</label>
                                                        <input
                                                            type="number"
                                                            value={tier.max}
                                                            onChange={(e) => updatePricingTier(index, 'max', e.target.value)}
                                                            placeholder="∞"
                                                            min="0"
                                                            className="w-full p-2.5 border border-slate-200 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:border-blue-400 text-sm transition-all outline-none"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs text-slate-500 mb-1">Цена</label>
                                                        <input
                                                            type="number"
                                                            value={tier.price}
                                                            onChange={(e) => updatePricingTier(index, 'price', e.target.value)}
                                                            placeholder="2000"
                                                            min="0"
                                                            className="w-full p-2.5 border border-slate-200 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:border-blue-400 text-sm transition-all outline-none"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs text-slate-500 mb-1">Метрика</label>
                                                        <select
                                                            value={tier.metric}
                                                            onChange={(e) => updatePricingTier(index, 'metric', e.target.value)}
                                                            className="w-full p-2.5 border border-slate-200 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:border-blue-400 text-sm transition-all outline-none"
                                                        >
                                                            <option value="views">Просмотры</option>
                                                            <option value="likes">Лайки</option>
                                                            <option value="comments">Комменты</option>
                                                        </select>
                                                    </div>
                                                </div>

                                                {rowErrors.length > 0 && (
                                                    <div className="text-xs text-red-500 mt-2 bg-red-50 rounded-lg p-2">
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
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">👥 Мин. подписчиков</label>
                                <input
                                    type="number"
                                    value={newTask.minFollowers}
                                    onChange={(e) => setNewTask({ ...newTask, minFollowers: e.target.value })}
                                    className="w-full p-3.5 border border-slate-200 rounded-xl bg-white text-gray-900 placeholder-gray-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all outline-none"
                                    placeholder="10000"
                                    min="0"
                                />
                            </div>

                            {!newTask.usePricingTiers && (
                                <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200">
                                    <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                                        <TargetIcon className="w-4 h-4" /> Целевые метрики
                                    </h3>
                                    <div className="grid grid-cols-3 gap-3">
                                        <div>
                                            <label className="block text-xs text-slate-500 mb-1">Просмотры</label>
                                            <input
                                                type="number"
                                                value={newTask.targetViews}
                                                onChange={(e) => setNewTask({ ...newTask, targetViews: e.target.value })}
                                                className="w-full p-2.5 border border-slate-200 rounded-xl bg-white text-gray-900 placeholder-gray-400 focus:border-blue-400 text-sm transition-all outline-none"
                                                placeholder="10000"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-slate-500 mb-1">Лайки</label>
                                            <input
                                                type="number"
                                                value={newTask.targetLikes}
                                                onChange={(e) => setNewTask({ ...newTask, targetLikes: e.target.value })}
                                                className="w-full p-2.5 border border-slate-200 rounded-xl bg-white text-gray-900 placeholder-gray-400 focus:border-blue-400 text-sm transition-all outline-none"
                                                placeholder="500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-slate-500 mb-1">Комментарии</label>
                                            <input
                                                type="number"
                                                value={newTask.targetComments}
                                                onChange={(e) => setNewTask({ ...newTask, targetComments: e.target.value })}
                                                className="w-full p-2.5 border border-slate-200 rounded-xl bg-white text-gray-900 placeholder-gray-400 focus:border-blue-400 text-sm transition-all outline-none"
                                                placeholder="50"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Дней на метрики</label>
                                    <input
                                        type="number"
                                        value={newTask.metricDeadlineDays}
                                        onChange={(e) => setNewTask({ ...newTask, metricDeadlineDays: e.target.value })}
                                        className="w-full p-3.5 border border-slate-200 rounded-xl bg-white text-gray-900 placeholder-gray-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all outline-none"
                                        placeholder="7"
                                        min="1"
                                        max="90"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">👥 Макс. инфлюенсеров</label>
                                    <input
                                        type="number"
                                        value={newTask.maxInfluencers}
                                        onChange={(e) => setNewTask({ ...newTask, maxInfluencers: e.target.value })}
                                        className="w-full p-3.5 border border-slate-200 rounded-xl bg-white text-gray-900 placeholder-gray-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all outline-none"
                                        placeholder="Без ограничения"
                                        min="1"
                                    />
                                    <p className="text-xs text-slate-400 mt-1">Пусто = без ограничений</p>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white py-4 rounded-xl font-semibold hover:shadow-lg hover:scale-[1.02] transition-all disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <>
                                        <span className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></span>
                                        Создание...
                                    </>
                                ) : <><PlusIcon className="w-5 h-5" /> Создать заказ</>}
                            </button>
                        </form>
                    </div>
                </div>
            )
            }

            {/* Модальное окно деталей задания */}
            {
                selectedTask && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                            <div className={`px-6 py-4 border-b ${selectedTask.status === 'open' ? 'bg-gradient-to-r from-green-50 to-emerald-50' :
                                selectedTask.status === 'in_progress' ? 'bg-gradient-to-r from-blue-50 to-indigo-50' :
                                    selectedTask.status === 'completed' ? 'bg-gradient-to-r from-slate-50 to-slate-100' :
                                        'bg-gradient-to-r from-red-50 to-orange-50'
                                }`}>
                                <div className="flex items-center justify-between">
                                    <h2 className="text-xl font-bold text-slate-800">{selectedTask.title}</h2>
                                    <button
                                        onClick={() => setSelectedTask(null)}
                                        className="w-8 h-8 flex items-center justify-center rounded-full bg-white/50 hover:bg-white text-slate-500 hover:text-slate-700 transition-colors"
                                    >
                                        <Cross2Icon className="w-4 h-4" />
                                    </button>
                                </div>
                                <span className={`inline-block text-xs px-2.5 py-1 rounded-full font-medium mt-2 ${selectedTask.status === 'open' ? 'bg-green-100 text-green-700' :
                                    selectedTask.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                                        selectedTask.status === 'completed' ? 'bg-slate-200 text-slate-600' : 'bg-red-100 text-red-700'
                                    }`}>
                                    {selectedTask.status === 'open' ? 'Активен' :
                                        selectedTask.status === 'in_progress' ? 'В работе' :
                                            selectedTask.status === 'completed' ? 'Завершен' : selectedTask.status}
                                </span>
                            </div>

                            <div className="p-6 space-y-4">
                                <div>
                                    <h3 className="text-sm font-medium text-slate-500 mb-1">Описание</h3>
                                    <p className="text-slate-700 whitespace-pre-wrap">{selectedTask.description}</p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-purple-50 rounded-xl p-3">
                                        <span className="text-xs text-purple-600">Бюджет</span>
                                        <p className="text-lg font-bold text-purple-700">{formatTaskBudget(selectedTask, { prefix: '' })}</p>
                                    </div>
                                    {selectedTask.deadline && (
                                        <div className="bg-amber-50 rounded-xl p-3">
                                            <span className="text-xs text-amber-600">Дедлайн</span>
                                            <p className="text-lg font-bold text-amber-700">{new Date(selectedTask.deadline).toLocaleDateString('ru')}</p>
                                        </div>
                                    )}
                                </div>

                                {selectedTask.target_metrics && (
                                    <div>
                                        <h3 className="text-sm font-medium text-slate-500 mb-2">Целевые метрики</h3>
                                        <div className="flex flex-wrap gap-2">
                                            {selectedTask.target_metrics.views && (
                                                <span className="bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg text-sm flex items-center gap-1">
                                                    <EyeOpenIcon className="w-3 h-3" /> {selectedTask.target_metrics.views.toLocaleString()} просмотров
                                                </span>
                                            )}
                                            {selectedTask.target_metrics.likes && (
                                                <span className="bg-pink-100 text-pink-700 px-3 py-1.5 rounded-lg text-sm flex items-center gap-1">
                                                    <HeartIcon className="w-3 h-3" /> {selectedTask.target_metrics.likes.toLocaleString()} лайков
                                                </span>
                                            )}
                                            {selectedTask.target_metrics.comments && (
                                                <span className="bg-green-100 text-green-700 px-3 py-1.5 rounded-lg text-sm flex items-center gap-1">
                                                    <ChatBubbleIcon className="w-3 h-3" /> {selectedTask.target_metrics.comments.toLocaleString()} комментов
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {selectedTask.requirements && selectedTask.requirements.minFollowers && (
                                    <div>
                                        <h3 className="text-sm font-medium text-slate-500 mb-2">Требования</h3>
                                        <div className="flex flex-wrap gap-2">
                                            <span className="bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg text-sm">
                                                👥 от {selectedTask.requirements.minFollowers.toLocaleString()} подписчиков
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {selectedTask.influencer && (
                                    <div className="bg-pink-50 rounded-xl p-4">
                                        <h3 className="text-sm font-medium text-pink-600 mb-2">Исполнитель</h3>
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-pink-200 rounded-full flex items-center justify-center">
                                                <CameraIcon className="w-5 h-5 text-pink-600" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-slate-800">{selectedTask.influencer.first_name} {selectedTask.influencer.last_name || ''}</p>
                                                {selectedTask.influencer.instagram_username && (
                                                    <a
                                                        href={`https://instagram.com/${selectedTask.influencer.instagram_username}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-sm text-pink-600 hover:underline"
                                                    >
                                                        @{selectedTask.influencer.instagram_username}
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="flex items-center justify-between text-sm text-slate-400 pt-4 border-t">
                                    <span>Создано: {new Date(selectedTask.created_at).toLocaleDateString('ru')}</span>
                                    {selectedTask.accepted_count > 0 && (
                                        <span>Откликов: {selectedTask.accepted_count}</span>
                                    )}
                                </div>
                            </div>

                            <div className="px-6 pb-6">
                                <button
                                    onClick={() => setSelectedTask(null)}
                                    className="w-full bg-slate-100 text-slate-700 py-3 rounded-xl font-medium hover:bg-slate-200 transition-colors"
                                >
                                    Закрыть
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            <footer className="text-center py-8 text-sm text-slate-400">
                Telegram Influencer Marketplace • Кабинет заказчика
            </footer>
        </div >
    )
}

export default WebClientDashboard
