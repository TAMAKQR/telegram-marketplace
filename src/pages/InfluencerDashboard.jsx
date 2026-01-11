import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useUserStore } from '../store/userStore'
import { useTelegram } from '../hooks/useTelegram'

function InfluencerDashboard() {
    const navigate = useNavigate()
    const { user } = useTelegram()
    const { profile } = useUserStore()
    const [tasks, setTasks] = useState([])
    const [myApplications, setMyApplications] = useState([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState('available') // available, my_applications
    const [influencerProfile, setInfluencerProfile] = useState(null)

    useEffect(() => {
        if (profile?.id) {
            loadInfluencerProfile()
            loadTasks()
            loadMyApplications()
        }
    }, [profile])

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
                .order('created_at', { ascending: false })

            if (error) throw error
            setMyApplications(data || [])
        } catch (error) {
            console.error('Ошибка загрузки откликов:', error)
        }
    }

    const hasApplied = (taskId) => {
        return myApplications.some(app => app.task_id === taskId)
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
        <div className="min-h-screen pb-20">
            {/* Header */}
            <div className="bg-tg-button text-tg-button-text p-4 sticky top-0 z-10">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-2xl font-bold">Задания</h1>
                        <p className="text-sm opacity-90">Привет, {user?.first_name}! 📸</p>
                    </div>
                    <button
                        onClick={() => navigate('/influencer/profile')}
                        className="bg-white/20 px-4 py-2 rounded-full text-sm"
                    >
                        {influencerProfile ? '⚙️ Профиль' : '⚠️ Настроить профиль'}
                    </button>
                </div>

                {/* Balance */}
                <div className="mt-3 bg-white/10 backdrop-blur-sm rounded-xl p-3 flex justify-between items-center">
                    <div>
                        <div className="text-xs opacity-75">Баланс</div>
                        <div className="text-xl font-bold">{(profile?.balance || 0).toLocaleString()} сом</div>
                    </div>
                    <button
                        onClick={() => navigate('/balance')}
                        className="px-4 py-2 bg-white/20 rounded-lg text-sm font-medium hover:bg-white/30 transition-colors"
                    >
                        Вывести
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
            <div className="flex gap-2 p-4">
                <button
                    onClick={() => setActiveTab('available')}
                    className={`px-4 py-2 rounded-full flex-1 transition-colors ${activeTab === 'available'
                        ? 'bg-tg-button text-tg-button-text'
                        : 'bg-gray-200 dark:bg-gray-700'
                        }`}
                >
                    Доступные
                </button>
                <button
                    onClick={() => setActiveTab('my_applications')}
                    className={`px-4 py-2 rounded-full flex-1 transition-colors ${activeTab === 'my_applications'
                        ? 'bg-tg-button text-tg-button-text'
                        : 'bg-gray-200 dark:bg-gray-700'
                        }`}
                >
                    Мои отклики ({myApplications.length})
                </button>
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
                                        <h3 className="font-semibold text-lg flex-1">{task.title}</h3>
                                        {alreadyApplied && (
                                            <span className="text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded-full ml-2">
                                                Откликнулись
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-tg-hint text-sm mb-3 line-clamp-2">
                                        {task.description}
                                    </p>
                                    <div className="flex justify-between items-center">
                                        <span className="font-semibold text-tg-button text-lg">
                                            {task.budget} сом
                                        </span>
                                        {task.category && (
                                            <span className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                                                {task.category}
                                            </span>
                                        )}
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
                ) : (
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
                                        {app.proposed_price || app.tasks.budget} сом
                                    </span>
                                    <span className="text-xs text-tg-hint">
                                        {new Date(app.created_at).toLocaleDateString('ru')}
                                    </span>
                                </div>
                            </div>
                        ))
                    )
                )}
            </div>
        </div>
    )
}

export default InfluencerDashboard
