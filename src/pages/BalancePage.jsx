import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useUserStore } from '../store/userStore'
import { useTelegram } from '../hooks/useTelegram'
import Logo from '../components/Logo'

function BalancePage() {
    const navigate = useNavigate()
    const { user, showAlert } = useTelegram()
    const { profile, updateProfile } = useUserStore()
    const [amount, setAmount] = useState('')
    const [transactions, setTransactions] = useState([])
    const [loading, setLoading] = useState(false)
    const [activeTab, setActiveTab] = useState('deposit') // deposit, history

    useEffect(() => {
        if (profile?.id) {
            loadTransactions()
        }
    }, [profile])

    const loadTransactions = async () => {
        try {
            const { data, error } = await supabase
                .from('transactions')
                .select('*')
                .or(`from_user_id.eq.${profile.id},to_user_id.eq.${profile.id}`)
                .order('created_at', { ascending: false })
                .limit(20)

            if (error) throw error
            setTransactions(data || [])
        } catch (error) {
            console.error('Ошибка загрузки транзакций:', error)
        }
    }

    const handleDeposit = async () => {
        if (!amount || parseFloat(amount) <= 0) {
            showAlert?.('Введите корректную сумму')
            return
        }

        setLoading(true)
        try {
            // Simulate payment (в реальности здесь была бы интеграция с платежной системой)
            const newBalance = (profile.balance || 0) + parseFloat(amount)

            // Update user balance
            const { error: updateError } = await supabase
                .from('users')
                .update({ balance: newBalance })
                .eq('id', profile.id)

            if (updateError) throw updateError

            // Create transaction record
            const { error: transactionError } = await supabase
                .from('transactions')
                .insert({
                    to_user_id: profile.id,
                    amount: parseFloat(amount),
                    type: 'deposit',
                    status: 'completed',
                    description: 'Пополнение баланса'
                })

            if (transactionError) throw transactionError

            // Update local state
            updateProfile({ balance: newBalance })
            setAmount('')
            loadTransactions()

            showAlert?.(`✅ Баланс пополнен на ${amount} сом`)
        } catch (error) {
            console.error('Ошибка пополнения:', error)
            showAlert?.('Ошибка при пополнении баланса')
        } finally {
            setLoading(false)
        }
    }

    const handleWithdrawal = async () => {
        if (!amount || parseFloat(amount) <= 0) {
            showAlert?.('Введите корректную сумму')
            return
        }

        if (parseFloat(amount) > (profile.balance || 0)) {
            showAlert?.('Недостаточно средств на балансе')
            return
        }

        setLoading(true)
        try {
            const newBalance = (profile.balance || 0) - parseFloat(amount)

            // Update user balance
            const { error: updateError } = await supabase
                .from('users')
                .update({ balance: newBalance })
                .eq('id', profile.id)

            if (updateError) throw updateError

            // Create transaction record
            const { error: transactionError } = await supabase
                .from('transactions')
                .insert({
                    from_user_id: profile.id,
                    amount: parseFloat(amount),
                    type: 'withdrawal',
                    status: 'completed',
                    description: 'Вывод средств'
                })

            if (transactionError) throw transactionError

            // Update local state
            updateProfile({ balance: newBalance })
            setAmount('')
            loadTransactions()

            showAlert?.(`✅ Средства выведены: ${amount} сом`)
        } catch (error) {
            console.error('Ошибка вывода:', error)
            showAlert?.('Ошибка при выводе средств')
        } finally {
            setLoading(false)
        }
    }

    const getTransactionIcon = (transaction) => {
        if (transaction.to_user_id === profile.id) {
            return '+'
        }
        return '-'
    }

    const getTransactionColor = (transaction) => {
        if (transaction.to_user_id === profile.id) {
            return 'text-green-600 dark:text-green-400'
        }
        return 'text-red-600 dark:text-red-400'
    }

    const getTypeLabel = (type) => {
        const labels = {
            deposit: 'Пополнение',
            withdrawal: 'Вывод',
            task_payment: 'Оплата задания',
            task_refund: 'Возврат',
            task_hold: 'Удержание'
        }
        return labels[type] || type
    }

    return (
        <div className="min-h-screen pb-6 overflow-x-hidden">
            {/* Header */}
            <div className="bg-brand-gradient text-white p-4 pt-8">
                <div className="flex items-center gap-3 mb-4">
                    <Logo className="h-7 w-auto" />
                    <button onClick={() => navigate(-1)} className="text-2xl">←</button>
                    <h1 className="text-2xl font-bold">Баланс</h1>
                </div>

                {/* Current Balance */}
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center">
                    <div className="text-sm opacity-75 mb-1">Текущий баланс</div>
                    <div className="text-3xl font-bold">{(profile?.balance || 0).toLocaleString()} сом</div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 p-4">
                <button
                    onClick={() => setActiveTab('deposit')}
                    className={`px-4 py-2 rounded-full flex-1 transition-colors ${activeTab === 'deposit'
                        ? 'bg-tg-button text-tg-button-text'
                        : 'bg-gray-200 dark:bg-gray-700'
                        }`}
                >
                    {profile?.user_type === 'client' ? 'Пополнить' : 'Вывести'}
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`px-4 py-2 rounded-full flex-1 transition-colors ${activeTab === 'history'
                        ? 'bg-tg-button text-tg-button-text'
                        : 'bg-gray-200 dark:bg-gray-700'
                        }`}
                >
                    История
                </button>
            </div>

            {/* Content */}
            <div className="p-4">
                {activeTab === 'deposit' ? (
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-md space-y-4">
                        <h3 className="text-lg font-semibold">
                            {profile?.user_type === 'client' ? 'Пополнение баланса' : 'Вывод средств'}
                        </h3>

                        <div>
                            <label className="block text-sm text-tg-hint mb-2">Сумма (сом)</label>
                            <input
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="Введите сумму"
                                className="w-full px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-700 outline-none"
                                disabled={loading}
                            />
                        </div>

                        {/* Quick amounts */}
                        <div className="grid grid-cols-4 gap-2">
                            {[500, 1000, 2000, 5000].map(quick => (
                                <button
                                    key={quick}
                                    onClick={() => setAmount(quick.toString())}
                                    className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-sm hover:bg-gray-200 dark:hover:bg-gray-600"
                                    disabled={loading}
                                >
                                    {quick}
                                </button>
                            ))}
                        </div>

                        {profile?.user_type === 'client' ? (
                            <>
                                <div className="text-xs text-tg-hint p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                                    💡 В реальном приложении здесь будет интеграция с платежной системой (Kaspi, O!Деньги и т.д.)
                                </div>

                                <button
                                    onClick={handleDeposit}
                                    disabled={loading || !amount}
                                    className="w-full bg-tg-button text-tg-button-text py-4 rounded-xl font-semibold disabled:opacity-50"
                                >
                                    {loading ? 'Обработка...' : 'Пополнить баланс'}
                                </button>
                            </>
                        ) : (
                            <>
                                <div className="text-xs text-tg-hint p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                                    💡 Средства будут переведены на вашу карту в течение 1-3 рабочих дней
                                </div>

                                <button
                                    onClick={handleWithdrawal}
                                    disabled={loading || !amount || parseFloat(amount) > (profile?.balance || 0)}
                                    className="w-full bg-tg-button text-tg-button-text py-4 rounded-xl font-semibold disabled:opacity-50"
                                >
                                    {loading ? 'Обработка...' : 'Вывести средства'}
                                </button>
                            </>
                        )}
                    </div>
                ) : (
                    <div className="space-y-3">
                        <h3 className="text-lg font-semibold px-2">История транзакций</h3>

                        {transactions.length === 0 ? (
                            <div className="text-center py-10 bg-white dark:bg-gray-800 rounded-xl">
                                <p className="text-tg-hint">Нет транзакций</p>
                            </div>
                        ) : (
                            transactions.map(transaction => (
                                <div key={transaction.id} className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md flex items-center justify-between">
                                    <div className="flex-1">
                                        <div className="font-semibold">{getTypeLabel(transaction.type)}</div>
                                        {transaction.description && (
                                            <div className="text-sm text-tg-hint">{transaction.description}</div>
                                        )}
                                        <div className="text-xs text-tg-hint mt-1">
                                            {new Date(transaction.created_at).toLocaleString('ru-RU')}
                                        </div>
                                    </div>
                                    <div className={`text-lg font-bold ${getTransactionColor(transaction)}`}>
                                        {getTransactionIcon(transaction)}{transaction.amount.toLocaleString()} сом
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

export default BalancePage
