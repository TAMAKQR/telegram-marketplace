import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useUserStore } from '../store/userStore'
import { useTelegram } from '../hooks/useTelegram'

function ClientDashboard() {
    const navigate = useNavigate()
    const { user } = useTelegram()
    const { profile } = useUserStore()
    const [tasks, setTasks] = useState([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState('all') // all, open, in_progress, completed

    useEffect(() => {
        if (profile?.id) {
            loadTasks()
        }
    }, [profile, activeTab])

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
        <div className="min-h-screen pb-20">
            {/* Header */}
            <div className="bg-tg-button text-tg-button-text p-4 sticky top-0 z-10">
                <h1 className="text-2xl font-bold">Мои задания</h1>
                <p className="text-sm opacity-90">Привет, {user?.first_name}! 👋</p>

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
                        Пополнить
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 p-4 overflow-x-auto">
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
                            ? 'bg-tg-button text-tg-button-text'
                            : 'bg-gray-200 dark:bg-gray-700'
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tasks List */}
            <div className="p-4 space-y-3">
                {loading ? (
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
                                className="bg-tg-button text-tg-button-text px-6 py-3 rounded-xl font-semibold"
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
                            className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md hover:shadow-lg transition-shadow cursor-pointer"
                        >
                            <div className="flex justify-between items-start mb-2">
                                <h3 className="font-semibold text-lg flex-1">{task.title}</h3>
                                <span className="text-xs ml-2">{getStatusText(task.status)}</span>
                            </div>
                            <p className="text-tg-hint text-sm mb-3 line-clamp-2">
                                {task.description}
                            </p>
                            <div className="flex justify-between items-center">
                                <span className="font-semibold text-tg-button">
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
                className="fixed bottom-6 right-6 bg-tg-button text-tg-button-text w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-2xl hover:scale-110 transition-transform"
            >
                +
            </button>
        </div>
    )
}

export default ClientDashboard
