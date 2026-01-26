import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useUserStore } from '../store/userStore'
import { useTelegram } from '../hooks/useTelegram'
import Logo from '../components/Logo'

function AccountantPanel() {
    const navigate = useNavigate()
    const { user, profile } = useUserStore()
    const { showAlert } = useTelegram()

    const [loading, setLoading] = useState(false)
    const [withdrawals, setWithdrawals] = useState([])
    const [filter, setFilter] = useState('pending') // all, pending, approved, rejected

    useEffect(() => {
        // Проверка что пользователь бухгалтер
        if (!profile || profile.role !== 'accountant') {
            showAlert?.('Доступ запрещен. Только для бухгалтеров.')
            navigate('/')
            return
        }
        loadWithdrawals()
    }, [profile, filter])

    const loadWithdrawals = async () => {
        setLoading(true)
        try {
            let query = supabase
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

            if (filter !== 'all') {
                query = query.eq('status', filter)
            }

            const { data, error } = await query

            if (error) throw error
            setWithdrawals(data || [])
        } catch (error) {
            console.error('Ошибка загрузки заявок:', error)
        } finally {
            setLoading(false)
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

            showAlert?.(status === 'approved' ? 'Выплата одобрена и средства списаны' : 'Заявка отклонена')
            loadWithdrawals()
        } catch (error) {
            console.error('Ошибка обработки заявки:', error)
            showAlert?.('Ошибка: ' + error.message)
        }
    }

    const getStatusBadge = (status) => {
        const badges = {
            pending: { text: '⏳ На рассмотрении', class: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200' },
            approved: { text: '✅ Одобрено', class: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200' },
            rejected: { text: '❌ Отклонено', class: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200' }
        }
        const badge = badges[status] || badges.pending
        return <span className={`px-3 py-1 rounded-full text-xs font-medium ${badge.class}`}>{badge.text}</span>
    }

    const pendingCount = withdrawals.filter(w => w.status === 'pending').length

    return (
        <div className="min-h-screen bg-tg-bg pb-20 overflow-x-hidden">
            {/* Header */}
            <div className="bg-purple-600 text-white p-4 pt-8">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                        <Logo />
                        <div>
                            <h1 className="text-xl font-bold">👔 Бухгалтерия</h1>
                            <p className="text-sm opacity-90">Управление выплатами</p>
                        </div>
                    </div>
                    <button
                        onClick={() => navigate('/')}
                        className="px-4 py-2 bg-white/20 rounded-lg text-sm"
                    >
                        ← Назад
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex gap-2 p-4 overflow-x-auto">
                <button
                    onClick={() => setFilter('pending')}
                    className={`px-4 py-2 rounded-full whitespace-nowrap transition-colors ${filter === 'pending'
                        ? 'bg-yellow-500 text-white'
                        : 'bg-gray-200 dark:bg-gray-700'
                        }`}
                >
                    ⏳ Ожидают ({withdrawals.filter(w => w.status === 'pending').length})
                </button>
                <button
                    onClick={() => setFilter('approved')}
                    className={`px-4 py-2 rounded-full whitespace-nowrap transition-colors ${filter === 'approved'
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-200 dark:bg-gray-700'
                        }`}
                >
                    ✅ Одобренные
                </button>
                <button
                    onClick={() => setFilter('rejected')}
                    className={`px-4 py-2 rounded-full whitespace-nowrap transition-colors ${filter === 'rejected'
                        ? 'bg-red-500 text-white'
                        : 'bg-gray-200 dark:bg-gray-700'
                        }`}
                >
                    ❌ Отклоненные
                </button>
                <button
                    onClick={() => setFilter('all')}
                    className={`px-4 py-2 rounded-full whitespace-nowrap transition-colors ${filter === 'all'
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-200 dark:bg-gray-700'
                        }`}
                >
                    📋 Все
                </button>
            </div>

            {/* Withdrawal List */}
            <div className="p-4 space-y-3">
                {loading ? (
                    <div className="text-center py-10 text-tg-hint">
                        Загрузка...
                    </div>
                ) : withdrawals.length === 0 ? (
                    <div className="text-center py-10 text-tg-hint">
                        {filter === 'pending' ? 'Нет новых заявок' : 'Заявок не найдено'}
                    </div>
                ) : (
                    withdrawals.map(request => (
                        <div key={request.id} className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md">
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <p className="font-semibold text-lg text-tg-button">
                                        {request.amount.toLocaleString()} сом
                                    </p>
                                    <p className="text-sm font-medium">
                                        {request.users?.first_name} {request.users?.last_name || ''}
                                    </p>
                                    <p className="text-xs text-tg-hint">
                                        Telegram: {request.users?.telegram_id}
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
                                {getStatusBadge(request.status)}
                            </div>

                            {/* Payment Details */}
                            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 mb-3">
                                <p className="text-sm font-medium mb-2">
                                    {request.payment_method === 'kaspi' ? '📱 Kaspi Gold' : '💳 Банковская карта'}
                                </p>
                                {request.payment_method === 'kaspi' && (
                                    <div>
                                        <p className="text-sm">
                                            <span className="text-tg-hint">Номер:</span>{' '}
                                            <span className="font-mono break-all">{request.payment_details.phoneNumber}</span>
                                        </p>
                                    </div>
                                )}
                                {request.payment_method === 'card' && (
                                    <div className="space-y-1">
                                        <p className="text-sm">
                                            <span className="text-tg-hint">Карта:</span>{' '}
                                            <span className="font-mono break-all">{request.payment_details.cardNumber}</span>
                                        </p>
                                        <p className="text-sm">
                                            <span className="text-tg-hint">Владелец:</span>{' '}
                                            <span className="break-words">{request.payment_details.cardHolder}</span>
                                        </p>
                                    </div>
                                )}
                                <p className="text-xs text-tg-hint mt-2 pt-2 border-t dark:border-gray-600">
                                    💰 Баланс инфлюенсера: {request.users?.balance?.toLocaleString() || 0} сом
                                </p>
                            </div>

                            {/* Admin Note */}
                            {request.admin_note && (
                                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 mb-3">
                                    <p className="text-xs text-tg-hint mb-1">💬 Комментарий:</p>
                                    <p className="text-sm break-words">{request.admin_note}</p>
                                </div>
                            )}

                            {/* Action Buttons */}
                            {request.status === 'pending' && (
                                <div className="space-y-2">
                                    <button
                                        onClick={() => {
                                            const note = prompt('Комментарий (необязательно):')
                                            processWithdrawal(request.id, 'approved', note || '')
                                        }}
                                        className="w-full bg-green-500 text-white py-3 rounded-xl font-medium hover:bg-green-600"
                                    >
                                        ✅ Одобрить и списать средства
                                    </button>
                                    <button
                                        onClick={() => {
                                            const note = prompt('Причина отклонения:')
                                            if (note) processWithdrawal(request.id, 'rejected', note)
                                        }}
                                        className="w-full bg-red-500 text-white py-3 rounded-xl font-medium hover:bg-red-600"
                                    >
                                        ❌ Отклонить заявку
                                    </button>
                                    <p className="text-xs text-center text-tg-hint">
                                        ℹ️ После одобрения деньги будут списаны с баланса инфлюенсера
                                    </p>
                                </div>
                            )}

                            {request.status === 'approved' && (
                                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
                                    <p className="text-sm text-green-800 dark:text-green-200">
                                        ✅ Выплата одобрена. Переведите {request.amount.toLocaleString()} сом на указанные реквизиты
                                    </p>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}

export default AccountantPanel
