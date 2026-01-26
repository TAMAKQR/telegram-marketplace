import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useUserStore } from '../store/userStore'
import { useTelegram } from '../hooks/useTelegram'
import Logo from '../components/Logo'

function WithdrawalPage() {
    const navigate = useNavigate()
    const { user, profile } = useUserStore()
    const { showAlert } = useTelegram()

    const [loading, setLoading] = useState(false)
    const [requests, setRequests] = useState([])
    const [showForm, setShowForm] = useState(false)

    const [formData, setFormData] = useState({
        amount: '',
        paymentMethod: 'kaspi',
        cardNumber: '',
        cardHolder: '',
        phoneNumber: ''
    })

    useEffect(() => {
        if (profile?.user_type !== 'influencer') {
            navigate('/')
            return
        }
        loadRequests()
    }, [profile])

    const loadRequests = async () => {
        try {
            const { data, error } = await supabase
                .from('withdrawal_requests')
                .select('*')
                .eq('influencer_id', user.id)
                .order('created_at', { ascending: false })

            if (error) throw error
            setRequests(data || [])
        } catch (error) {
            console.error('Error loading requests:', error)
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()

        const amount = parseFloat(formData.amount)

        if (amount <= 0) {
            showAlert?.('Введите корректную сумму')
            return
        }

        if (amount > profile.balance) {
            showAlert?.('Недостаточно средств на балансе')
            return
        }

        if (amount < 100) {
            showAlert?.('Минимальная сумма вывода: 100 сом')
            return
        }

        setLoading(true)
        try {
            const paymentDetails = {}

            if (formData.paymentMethod === 'kaspi') {
                if (!formData.phoneNumber) {
                    showAlert?.('Укажите номер телефона Kaspi')
                    setLoading(false)
                    return
                }
                paymentDetails.phoneNumber = formData.phoneNumber
            } else if (formData.paymentMethod === 'card') {
                if (!formData.cardNumber || !formData.cardHolder) {
                    showAlert?.('Заполните данные карты')
                    setLoading(false)
                    return
                }
                paymentDetails.cardNumber = formData.cardNumber
                paymentDetails.cardHolder = formData.cardHolder
            }

            const { error } = await supabase
                .from('withdrawal_requests')
                .insert([{
                    influencer_id: user.id,
                    amount: amount,
                    payment_method: formData.paymentMethod,
                    payment_details: paymentDetails,
                    status: 'pending'
                }])

            if (error) throw error

            showAlert?.('Заявка на вывод отправлена!')
            setShowForm(false)
            setFormData({
                amount: '',
                paymentMethod: 'kaspi',
                cardNumber: '',
                cardHolder: '',
                phoneNumber: ''
            })
            loadRequests()
        } catch (error) {
            console.error('Error creating request:', error)
            showAlert?.('Ошибка при создании заявки')
        } finally {
            setLoading(false)
        }
    }

    const getStatusBadge = (status) => {
        const badges = {
            pending: { text: 'На рассмотрении', class: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200' },
            approved: { text: 'Одобрено', class: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200' },
            rejected: { text: 'Отклонено', class: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200' },
            completed: { text: 'Выплачено', class: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200' }
        }
        const badge = badges[status] || badges.pending
        return <span className={`px-3 py-1 rounded-full text-xs font-medium ${badge.class}`}>{badge.text}</span>
    }

    return (
        <div className="min-h-screen bg-tg-bg pb-20 overflow-x-hidden">
            <div className="max-w-2xl mx-auto p-4">
                <div className="flex items-center justify-between mb-6">
                    <button
                        onClick={() => navigate('/influencer')}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                    >
                        ← Назад
                    </button>
                    <Logo />
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 mb-4">
                    <div className="text-center mb-6">
                        <h1 className="text-2xl font-bold mb-2">💰 Вывод средств</h1>
                        <p className="text-3xl font-bold text-tg-button">
                            {profile?.balance?.toLocaleString() || 0} сом
                        </p>
                        <p className="text-sm text-tg-hint">Доступно для вывода</p>
                    </div>

                    {!showForm ? (
                        <button
                            onClick={() => setShowForm(true)}
                            disabled={!profile?.balance || profile.balance < 100}
                            className="w-full bg-tg-button text-white py-3 rounded-xl font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Подать заявку на вывод
                        </button>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Сумма вывода (мин. 100 сом)
                                </label>
                                <input
                                    type="number"
                                    value={formData.amount}
                                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                    className="w-full p-3 rounded-lg border dark:bg-gray-700 dark:border-gray-600"
                                    placeholder="Введите сумму"
                                    min="100"
                                    max={profile?.balance}
                                    required
                                />
                                <p className="text-xs text-tg-hint mt-1">
                                    Максимум: {profile?.balance?.toLocaleString()} сом
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    Способ получения
                                </label>
                                <select
                                    value={formData.paymentMethod}
                                    onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                                    className="w-full p-3 rounded-lg border dark:bg-gray-700 dark:border-gray-600"
                                >
                                    <option value="kaspi">Kaspi Gold</option>
                                    <option value="card">Банковская карта</option>
                                </select>
                            </div>

                            {formData.paymentMethod === 'kaspi' && (
                                <div>
                                    <label className="block text-sm font-medium mb-2">
                                        Номер телефона Kaspi
                                    </label>
                                    <input
                                        type="tel"
                                        value={formData.phoneNumber}
                                        onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                                        className="w-full p-3 rounded-lg border dark:bg-gray-700 dark:border-gray-600"
                                        placeholder="+7 (___) ___-__-__"
                                        required
                                    />
                                </div>
                            )}

                            {formData.paymentMethod === 'card' && (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium mb-2">
                                            Номер карты
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.cardNumber}
                                            onChange={(e) => setFormData({ ...formData, cardNumber: e.target.value })}
                                            className="w-full p-3 rounded-lg border dark:bg-gray-700 dark:border-gray-600"
                                            placeholder="____ ____ ____ ____"
                                            maxLength="19"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-2">
                                            Имя владельца карты
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.cardHolder}
                                            onChange={(e) => setFormData({ ...formData, cardHolder: e.target.value })}
                                            className="w-full p-3 rounded-lg border dark:bg-gray-700 dark:border-gray-600"
                                            placeholder="IVAN IVANOV"
                                            required
                                        />
                                    </div>
                                </>
                            )}

                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowForm(false)}
                                    className="flex-1 bg-gray-200 dark:bg-gray-700 py-3 rounded-xl font-medium"
                                >
                                    Отмена
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex-1 bg-tg-button text-white py-3 rounded-xl font-medium hover:opacity-90 disabled:opacity-50"
                                >
                                    {loading ? 'Отправка...' : 'Отправить заявку'}
                                </button>
                            </div>
                        </form>
                    )}
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6">
                    <h2 className="text-lg font-semibold mb-4">История заявок</h2>

                    {requests.length === 0 ? (
                        <p className="text-center text-tg-hint py-8">
                            У вас пока нет заявок на вывод
                        </p>
                    ) : (
                        <div className="space-y-3">
                            {requests.map((request) => (
                                <div
                                    key={request.id}
                                    className="border dark:border-gray-700 rounded-xl p-4"
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <p className="font-semibold text-lg">
                                                {request.amount.toLocaleString()} сом
                                            </p>
                                            <p className="text-sm text-tg-hint">
                                                {new Date(request.created_at).toLocaleDateString('ru-RU', {
                                                    day: 'numeric',
                                                    month: 'long',
                                                    year: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </p>
                                        </div>
                                        {getStatusBadge(request.status)}
                                    </div>

                                    <div className="text-sm text-tg-hint">
                                        <p>
                                            {request.payment_method === 'kaspi' ? '📱 Kaspi Gold' : '💳 Банковская карта'}
                                        </p>
                                        {request.payment_method === 'kaspi' && (
                                            <p className="font-mono break-all">{request.payment_details.phoneNumber}</p>
                                        )}
                                        {request.payment_method === 'card' && (
                                            <p className="font-mono break-all">{request.payment_details.cardNumber}</p>
                                        )}
                                    </div>

                                    {request.admin_note && (
                                        <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                            <p className="text-xs text-tg-hint mb-1">Комментарий админа:</p>
                                            <p className="text-sm break-words">{request.admin_note}</p>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default WithdrawalPage
