import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useUserStore } from '../store/userStore'
import { useTelegram } from '../hooks/useTelegram'
import { isAdmin } from '../lib/telegramBot'
import Logo from '../components/Logo'
import { formatTaskBudget } from '../lib/taskBudget'

function InfluencerDashboard() {
    const navigate = useNavigate()
    const { user } = useTelegram()
    const { profile } = useUserStore()
    const [tasks, setTasks] = useState([])
    const [myApplications, setMyApplications] = useState([])
    const [inProgressTasks, setInProgressTasks] = useState([])
    const [revisionTasks, setRevisionTasks] = useState([])
    const [completedTasks, setCompletedTasks] = useState([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState('available') // available, my_applications, in_progress, revision, completed, admin
    const [influencerProfile, setInfluencerProfile] = useState(null)
    const [allUsers, setAllUsers] = useState([])
    const [usersLoading, setUsersLoading] = useState(false)
    const [balanceAmount, setBalanceAmount] = useState('')
    const [selectedUserId, setSelectedUserId] = useState('')

    useEffect(() => {
        if (profile?.id) {
            loadInfluencerProfile()
            loadTasks()
            loadMyApplications()
            loadInProgressTasks()
            loadRevisionTasks()
            loadCompletedTasks()
        }
    }, [profile])

    useEffect(() => {
        if (activeTab === 'admin' && user && isAdmin(user.id)) {
            loadAllUsers()
        }
    }, [activeTab, user])

    const loadInfluencerProfile = async () => {
        try {
            const { data, error } = await supabase
                .from('influencer_profiles')
                .select('*')
                .eq('user_id', profile.id)
                .single()

            if (data) {
                setInfluencerProfile(data)
            }
        } catch (error) {
            console.log('Профиль инфлюенсера не создан')
        }
    }

    const loadTasks = async () => {
        try {
            const { data, error } = await supabase
                .from('tasks')
                .select(`
          *,
          users!tasks_client_id_fkey(first_name, last_name),
          task_applications!left(id, influencer_id)
        `)
                .eq('status', 'open')
                .order('created_at', { ascending: false })

            if (error) throw error
            setTasks(data || [])
        } catch (error) {
            console.error('Ошибка загрузки заданий:', error)
        } finally {
            setLoading(false)
        }
    }

    const loadMyApplications = async () => {
        try {
            const { data, error } = await supabase
                .from('task_applications')
                .select(`
          *,
          tasks(*, users!tasks_client_id_fkey(first_name, last_name))
        `)
                .eq('influencer_id', profile.id)
                .in('status', ['pending', 'rejected', 'accepted'])
                .order('created_at', { ascending: false })

            if (error) throw error
            setMyApplications(data || [])
        } catch (error) {
            console.error('Ошибка загрузки откликов:', error)
        }
    }

    const loadInProgressTasks = async () => {
        try {
            // Загружаем задания через принятые заявки
            const { data, error } = await supabase
                .from('task_applications')
                .select(`
          *,
          tasks(
            *,
            users!tasks_client_id_fkey(first_name, last_name),
            task_submissions!left(*)
          )
        `)
                .eq('influencer_id', profile.id)
                .eq('status', 'accepted')
                .order('created_at', { ascending: false })

            if (error) throw error

            // Преобразуем данные - берём только задания, которые в статусе in_progress
            const tasksData = (data || [])
                .map(app => app.tasks)
                .filter(task => task && task.status === 'in_progress')

            setInProgressTasks(tasksData)
        } catch (error) {
            console.error('Ошибка загрузки заданий в работе:', error)
        }
    }

    const loadRevisionTasks = async () => {
        try {
            const { data, error } = await supabase
                .from('task_submissions')
                .select(`
          *,
          tasks(*, users!tasks_client_id_fkey(first_name, last_name))
        `)
                .eq('influencer_id', profile.id)
                .eq('status', 'revision_requested')
                .order('created_at', { ascending: false })

            if (error) throw error
            setRevisionTasks(data || [])
        } catch (error) {
            console.error('Ошибка загрузки заданий на доработке:', error)
        }
    }

    const loadCompletedTasks = async () => {
        try {
            const { data, error } = await supabase
                .from('tasks')
                .select(`
          *,
          users!tasks_client_id_fkey(first_name, last_name),
          task_submissions!inner(*)
        `)
                .eq('status', 'completed')
                .eq('accepted_influencer_id', profile.id)
                .order('updated_at', { ascending: false })

            if (error) throw error
            setCompletedTasks(data || [])
        } catch (error) {
            console.error('Ошибка загрузки завершенных заданий:', error)
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
            alert('Ошибка загрузки пользователей')
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
            await loadAllUsers() // Перезагружаем список
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
            const { error } = await supabase
                .from('users')
                .update({
                    balance: supabase.sql`balance + ${amount}`
                })
                .eq('id', selectedUserId)

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

    const hasApplied = (taskId) => {
        // Проверяем среди всех откликов, включая принятые
        return myApplications.some(app => app.task_id === taskId) ||
            inProgressTasks.some(task => task.id === taskId) ||
            revisionTasks.some(sub => sub.task_id === taskId) ||
            completedTasks.some(task => task.id === taskId)
    }

    const getStatusBadge = (status) => {
        const badges = {
            pending: '⏳ На рассмотрении',
            accepted: '✅ Принят',
            rejected: '❌ Отклонен'
        }
        return badges[status] || status
    }

    return (
        <div className="min-h-screen pb-20 overflow-x-hidden">
            {/* Header */}
            <div className="bg-brand-gradient text-white p-4 pt-8">
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                        <Logo className="h-7 w-auto" />
                        <div>
                            <h1 className="text-2xl font-bold">Задания</h1>
                            <p className="text-sm opacity-90">Привет, {user?.first_name}! 📸</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        {user && isAdmin(user.id) && (
                            <button
                                onClick={() => {
                                    console.log('Admin button clicked! Setting activeTab to admin')
                                    console.log('Current user:', user)
                                    console.log('Is admin?', isAdmin(user.id))
                                    setActiveTab('admin')
                                }}
                                className="bg-red-500/20 px-3 py-1 rounded-full text-xs text-red-200 hover:bg-red-500/30"
                            >
                                🔧 Админ
                            </button>
                        )}
                        <button
                            onClick={() => navigate('/influencer/profile')}
                            className="bg-white/20 px-4 py-2 rounded-full text-sm"
                        >
                            {influencerProfile ? '⚙️ Профиль' : '⚠️ Настроить профиль'}
                        </button>
                    </div>
                </div>

                {/* Balance */}
                <div className="mt-3 bg-white/10 backdrop-blur-sm rounded-xl p-3 flex justify-between items-center">
                    <div>
                        <div className="text-xs opacity-75">Баланс</div>
                        <div className="text-xl font-bold">{(profile?.balance || 0).toLocaleString()} сом</div>
                    </div>
                    <button
                        onClick={() => navigate('/withdrawal')}
                        className="px-4 py-2 bg-white/20 rounded-lg text-sm font-medium hover:bg-white/30 transition-colors"
                    >
                        💸 Вывести
                    </button>
                </div>
            </div>

            {/* Warning if no profile */}
            {!influencerProfile && (
                <div className="m-4 p-4 bg-yellow-100 dark:bg-yellow-900/30 rounded-xl border border-yellow-300 dark:border-yellow-700">
                    <p className="text-sm">
                        ⚠️ Чтобы откликаться на задания, сначала заполните свой профиль Instagram
                    </p>
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-1 p-4 overflow-x-auto">
                <button
                    onClick={() => setActiveTab('available')}
                    className={`px-3 py-2 rounded-full whitespace-nowrap text-sm transition-colors ${activeTab === 'available'
                        ? 'bg-brand text-white'
                        : 'bg-gray-200 dark:bg-gray-700'
                        }`}
                >
                    Доступные
                </button>
                <button
                    onClick={() => setActiveTab('my_applications')}
                    className={`px-3 py-2 rounded-full whitespace-nowrap text-sm transition-colors ${activeTab === 'my_applications'
                        ? 'bg-brand text-white'
                        : 'bg-gray-200 dark:bg-gray-700'
                        }`}
                >
                    Мои отклики ({myApplications.length})
                </button>
                <button
                    onClick={() => setActiveTab('in_progress')}
                    className={`px-3 py-2 rounded-full whitespace-nowrap text-sm transition-colors ${activeTab === 'in_progress'
                        ? 'bg-brand text-white'
                        : 'bg-gray-200 dark:bg-gray-700'
                        }`}
                >
                    В работе ({inProgressTasks.length})
                </button>
                <button
                    onClick={() => setActiveTab('revision')}
                    className={`px-3 py-2 rounded-full whitespace-nowrap text-sm transition-colors ${activeTab === 'revision'
                        ? 'bg-brand text-white'
                        : 'bg-gray-200 dark:bg-gray-700'
                        }`}
                >
                    На доработке ({revisionTasks.length})
                </button>
                <button
                    onClick={() => setActiveTab('completed')}
                    className={`px-3 py-2 rounded-full whitespace-nowrap text-sm transition-colors ${activeTab === 'completed'
                        ? 'bg-brand text-white'
                        : 'bg-gray-200 dark:bg-gray-700'
                        }`}
                >
                    Завершенные ({completedTasks.length})
                </button>
                {user && isAdmin(user.id) && (
                    <button
                        onClick={() => {
                            console.log('Tab Admin button clicked! Setting activeTab to admin')
                            console.log('Current activeTab:', activeTab)
                            setActiveTab('admin')
                        }}
                        className={`px-3 py-2 rounded-full whitespace-nowrap text-sm transition-colors ${activeTab === 'admin'
                            ? 'bg-red-500 text-white'
                            : 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'
                            }`}
                    >
                        🔧 Админ
                    </button>
                )}
            </div>

            {/* Content */}
            <div className="p-4 space-y-3">
                {loading ? (
                    <div className="text-center py-10">
                        <div className="text-tg-hint">Загрузка...</div>
                    </div>
                ) : activeTab === 'available' ? (
                    tasks.length === 0 ? (
                        <div className="text-center py-10">
                            <div className="text-4xl mb-4">📭</div>
                            <p className="text-tg-hint">Пока нет доступных заданий</p>
                        </div>
                    ) : (
                        tasks.map(task => {
                            const alreadyApplied = hasApplied(task.id)
                            return (
                                <div
                                    key={task.id}
                                    onClick={() => navigate(`/influencer/task/${task.id}`)}
                                    className={`bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md hover:shadow-lg transition-shadow cursor-pointer ${alreadyApplied ? 'opacity-60' : ''
                                        }`}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="font-semibold text-lg flex-1 break-words">{task.title}</h3>
                                        {alreadyApplied && (
                                            <span className="text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded-full ml-2">
                                                Откликнулись
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-tg-hint text-sm mb-3 line-clamp-2 break-words">
                                        {task.description}
                                    </p>
                                    <div className="flex justify-between items-center">
                                        <span className="font-semibold text-tg-button text-lg">
                                            {formatTaskBudget(task, { prefix: '' })}
                                        </span>
                                    </div>
                                    {task.requirements?.minFollowers && (
                                        <p className="text-xs text-tg-hint mt-2">
                                            Мин. подписчиков: {task.requirements.minFollowers.toLocaleString()}
                                        </p>
                                    )}
                                </div>
                            )
                        })
                    )
                ) : activeTab === 'my_applications' ? (
                    myApplications.length === 0 ? (
                        <div className="text-center py-10">
                            <div className="text-4xl mb-4">📝</div>
                            <p className="text-tg-hint">У вас пока нет откликов</p>
                        </div>
                    ) : (
                        myApplications.map(app => (
                            <div
                                key={app.id}
                                onClick={() => navigate(`/influencer/task/${app.task_id}`)}
                                className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md hover:shadow-lg transition-shadow cursor-pointer"
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="font-semibold text-lg flex-1">
                                        {app.tasks.title}
                                    </h3>
                                    <span className="text-xs ml-2">
                                        {getStatusBadge(app.status)}
                                    </span>
                                </div>
                                <p className="text-tg-hint text-sm mb-3 line-clamp-2">
                                    {app.tasks.description}
                                </p>
                                <div className="flex justify-between items-center">
                                    <span className="font-semibold text-tg-button">
                                        {app.proposed_price ? `${Number(app.proposed_price).toLocaleString('ru-RU')} сом` : formatTaskBudget(app.tasks, { prefix: '' })}
                                    </span>
                                    <span className="text-xs text-tg-hint">
                                        {new Date(app.created_at).toLocaleDateString('ru')}
                                    </span>
                                </div>
                            </div>
                        ))
                    )
                ) : activeTab === 'in_progress' ? (
                    inProgressTasks.length === 0 ? (
                        <div className="text-center py-10">
                            <div className="text-4xl mb-4">⚙️</div>
                            <p className="text-tg-hint">Нет заданий в работе</p>
                        </div>
                    ) : (
                        inProgressTasks.map(task => (
                            <div
                                key={task.id}
                                onClick={() => navigate(`/influencer/task/${task.id}`)}
                                className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md hover:shadow-lg transition-shadow cursor-pointer"
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="font-semibold text-lg flex-1">{task.title}</h3>
                                    <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded-full">
                                        🟡 В работе
                                    </span>
                                </div>
                                <p className="text-tg-hint text-sm mb-3 line-clamp-2">
                                    {task.description}
                                </p>
                                <div className="flex justify-between items-center">
                                    <span className="font-semibold text-tg-button text-lg">
                                        {formatTaskBudget(task, { prefix: '' })}
                                    </span>
                                    {task.deadline && (
                                        <span className="text-xs text-red-600 dark:text-red-400">
                                            До: {new Date(task.deadline).toLocaleDateString('ru')}
                                        </span>
                                    )}
                                </div>
                                {!task.task_submissions?.length && (
                                    <div className="mt-2 p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg text-xs text-yellow-800 dark:text-yellow-200">
                                        💡 Нужно отправить отчет о выполнении
                                    </div>
                                )}
                            </div>
                        ))
                    )
                ) : activeTab === 'revision' ? (
                    revisionTasks.length === 0 ? (
                        <div className="text-center py-10">
                            <div className="text-4xl mb-4">🔄</div>
                            <p className="text-tg-hint">Нет заданий на доработке</p>
                        </div>
                    ) : (
                        revisionTasks.map(submission => (
                            <div
                                key={submission.id}
                                onClick={() => navigate(`/influencer/task/${submission.task_id}`)}
                                className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-orange-500"
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="font-semibold text-lg flex-1">{submission.tasks.title}</h3>
                                    <span className="text-xs bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 px-2 py-1 rounded-full">
                                        🔄 Доработка
                                    </span>
                                </div>
                                <p className="text-tg-hint text-sm mb-2">
                                    {submission.tasks.description}
                                </p>
                                {submission.revision_comment && (
                                    <div className="mb-3 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                                        <p className="text-sm font-medium text-orange-800 dark:text-orange-200">
                                            Комментарий заказчика:
                                        </p>
                                        <p className="text-sm mt-1 text-orange-700 dark:text-orange-300">
                                            {submission.revision_comment}
                                        </p>
                                    </div>
                                )}
                                <div className="flex justify-between items-center">
                                    <span className="font-semibold text-tg-button text-lg">
                                        {formatTaskBudget(submission.tasks, { prefix: '' })}
                                    </span>
                                    <span className="text-xs text-tg-hint">
                                        {new Date(submission.reviewed_at).toLocaleDateString('ru')}
                                    </span>
                                </div>
                            </div>
                        ))
                    )
                ) : activeTab === 'completed' ? (
                    completedTasks.length === 0 ? (
                        <div className="text-center py-10">
                            <div className="text-4xl mb-4">✅</div>
                            <p className="text-tg-hint">Нет завершенных заданий</p>
                        </div>
                    ) : (
                        completedTasks.map(task => (
                            <div
                                key={task.id}
                                onClick={() => navigate(`/influencer/task/${task.id}`)}
                                className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-green-500"
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="font-semibold text-lg flex-1">{task.title}</h3>
                                    <span className="text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded-full">
                                        ✅ Завершено
                                    </span>
                                </div>
                                <p className="text-tg-hint text-sm mb-3 line-clamp-2">
                                    {task.description}
                                </p>
                                <div className="flex justify-between items-center">
                                    <span className="font-semibold text-green-600 dark:text-green-400 text-lg">
                                        +{formatTaskBudget(task, { prefix: '' })}
                                    </span>
                                    <span className="text-xs text-tg-hint">
                                        {new Date(task.updated_at).toLocaleDateString('ru')}
                                    </span>
                                </div>
                            </div>
                        ))
                    )) : activeTab === 'admin' && user && isAdmin(user.id) ? (
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
                                                        >
                                                            🔄
                                                        </button>
                                                        <button
                                                            onClick={() => toggleUserBlock(user.id, user.is_blocked)}
                                                            className={`text-xs px-2 py-1 rounded transition-colors ${user.is_blocked
                                                                ? 'bg-green-100 hover:bg-green-200 text-green-800 dark:bg-green-900 dark:text-green-200'
                                                                : 'bg-red-100 hover:bg-red-200 text-red-800 dark:bg-red-900 dark:text-red-200'
                                                                }`}
                                                        >
                                                            {user.is_blocked ? '✅' : '🚫'}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>) : null}
            </div>
        </div>
    )
}

export default InfluencerDashboard
