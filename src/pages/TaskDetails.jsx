import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useUserStore } from '../store/userStore'
import { useTelegram } from '../hooks/useTelegram'

function TaskDetails() {
    const { taskId } = useParams()
    const navigate = useNavigate()
    const { showAlert, showConfirm } = useTelegram()
    const { profile, userType, updateProfile } = useUserStore()
    const [task, setTask] = useState(null)
    const [applications, setApplications] = useState([])
    const [myApplication, setMyApplication] = useState(null)
    const [loading, setLoading] = useState(true)
    const [applyMessage, setApplyMessage] = useState('')
    const [proposedPrice, setProposedPrice] = useState('')
    const [showApplyForm, setShowApplyForm] = useState(false)

    // Состояния для отчетов
    const [submissions, setSubmissions] = useState([])
    const [showSubmissionForm, setShowSubmissionForm] = useState(false)
    const [postUrl, setPostUrl] = useState('')
    const [workDescription, setWorkDescription] = useState('')
    const [revisionComment, setRevisionComment] = useState('')

    useEffect(() => {
        if (taskId) {
            loadTaskDetails()
        }
    }, [taskId])

    useEffect(() => {
        if (taskId && userType) {
            if (userType === 'client') {
                loadApplications()
            } else {
                checkMyApplication()
            }
            loadSubmissions()
        }
    }, [taskId, userType])

    const loadTaskDetails = async () => {
        try {
            const { data, error } = await supabase
                .from('tasks')
                .select(`
          *,
          users!tasks_client_id_fkey(first_name, last_name, username)
        `)
                .eq('id', taskId)
                .single()

            if (error) throw error
            setTask(data)
        } catch (error) {
            console.error('Ошибка загрузки задания:', error)
            showAlert?.('Задание не найдено')
            navigate(-1)
        } finally {
            setLoading(false)
        }
    }

    const loadApplications = async () => {
        try {
            const { data, error } = await supabase
                .from('task_applications')
                .select(`
          *,
          users:influencer_id(
            first_name,
            last_name,
            influencer_profiles(*)
          )
        `)
                .eq('task_id', taskId)
                .order('created_at', { ascending: false })

            if (error) throw error

            setApplications(data || [])
        } catch (error) {
            console.error('Ошибка загрузки откликов:', error)
        }
    }

    const checkMyApplication = async () => {
        try {
            const { data, error } = await supabase
                .from('task_applications')
                .select('*')
                .eq('task_id', taskId)
                .eq('influencer_id', profile.id)
                .single()

            if (data) {
                setMyApplication(data)
                setApplyMessage(data.message || '')
                setProposedPrice(data.proposed_price || '')
            }
        } catch (error) {
            console.log('Нет отклика на это задание')
        }
    }

    const loadSubmissions = async () => {
        try {
            const { data, error } = await supabase
                .from('task_submissions')
                .select('*')
                .eq('task_id', taskId)
                .order('created_at', { ascending: false })

            if (error) throw error

            setSubmissions(data || [])
        } catch (error) {
            console.error('Ошибка загрузки отчетов:', error)
        }
    }

    const handleSubmitWork = async () => {
        if (!postUrl.trim() || !workDescription.trim()) {
            showAlert?.('Заполните все поля: ссылка на пост и описание работы')
            return
        }

        try {
            const { error } = await supabase
                .from('task_submissions')
                .insert([
                    {
                        task_id: taskId,
                        influencer_id: profile.id,
                        post_url: postUrl,
                        description: workDescription,
                        status: 'pending'
                    }
                ])

            if (error) throw error

            showAlert?.('Отчет отправлен заказчику на проверку!')
            setShowSubmissionForm(false)
            setPostUrl('')
            setWorkDescription('')
            await loadSubmissions()
            await loadTaskDetails()
        } catch (error) {
            console.error('Ошибка отправки отчета:', error)
            showAlert?.('Ошибка при отправке отчета')
        }
    }

    const handleApproveSubmission = async (submissionId) => {
        const confirmed = await showConfirm?.(
            'Одобрить работу и произвести оплату?'
        )
        if (!confirmed) return

        try {
            // Находим принятый отклик для получения цены
            const acceptedApp = applications.find(app => app.status === 'accepted')
            if (!acceptedApp) {
                showAlert?.('Не найден принятый отклик')
                return
            }

            const paymentAmount = acceptedApp.proposed_price || task.budget

            // Проверяем баланс заказчика
            if (profile.balance < paymentAmount) {
                showAlert?.(`Недостаточно средств на балансе. Необходимо: ${paymentAmount} сом, доступно: ${profile.balance} сом`)
                return
            }

            // Обновляем статус отчета
            const { error: submissionError } = await supabase
                .from('task_submissions')
                .update({
                    status: 'approved',
                    reviewed_at: new Date().toISOString()
                })
                .eq('id', submissionId)

            if (submissionError) throw submissionError

            // Обновляем баланс заказчика
            const { error: clientError } = await supabase
                .from('users')
                .update({ balance: profile.balance - paymentAmount })
                .eq('id', profile.id)

            if (clientError) throw clientError

            // Обновляем баланс исполнителя
            const influencer = applications.find(app => app.status === 'accepted')
            const { data: influencerData, error: influencerFetchError } = await supabase
                .from('users')
                .select('balance')
                .eq('id', influencer.influencer_id)
                .single()

            if (influencerFetchError) throw influencerFetchError

            const { error: influencerUpdateError } = await supabase
                .from('users')
                .update({ balance: (influencerData.balance || 0) + paymentAmount })
                .eq('id', influencer.influencer_id)

            if (influencerUpdateError) throw influencerUpdateError

            // Создаем транзакцию
            const { error: transactionError } = await supabase
                .from('transactions')
                .insert([
                    {
                        from_user_id: profile.id,
                        to_user_id: influencer.influencer_id,
                        task_id: taskId,
                        amount: paymentAmount,
                        type: 'task_payment',
                        status: 'completed',
                        description: `Оплата за выполнение задания: ${task.title}`
                    }
                ])

            if (transactionError) throw transactionError

            // Обновляем статус задания
            const { error: taskError } = await supabase
                .from('tasks')
                .update({ status: 'completed' })
                .eq('id', taskId)

            if (taskError) throw taskError

            // Обновляем локальный профиль
            await updateProfile({ balance: profile.balance - paymentAmount })

            showAlert?.(`Работа одобрена! Оплачено ${paymentAmount} сом`)
            await loadSubmissions()
            await loadTaskDetails()
        } catch (error) {
            console.error('Ошибка одобрения работы:', error)
            showAlert?.('Ошибка при одобрении работы')
        }
    }

    const handleRequestRevision = async (submissionId) => {
        if (!revisionComment.trim()) {
            showAlert?.('Укажите что нужно доработать')
            return
        }

        try {
            const { error } = await supabase
                .from('task_submissions')
                .update({
                    status: 'revision_requested',
                    revision_comment: revisionComment,
                    reviewed_at: new Date().toISOString()
                })
                .eq('id', submissionId)

            if (error) throw error

            showAlert?.('Отчет отправлен на доработку')
            setRevisionComment('')
            await loadSubmissions()
        } catch (error) {
            console.error('Ошибка отправки на доработку:', error)
            showAlert?.('Ошибка при отправке на доработку')
        }
    }

    const handleApply = async () => {
        if (!applyMessage.trim()) {
            showAlert?.('Напишите сопроводительное сообщение')
            return
        }

        try {
            const { error } = await supabase
                .from('task_applications')
                .insert([
                    {
                        task_id: taskId,
                        influencer_id: profile.id,
                        message: applyMessage,
                        proposed_price: proposedPrice ? parseFloat(proposedPrice) : null,
                        status: 'pending'
                    }
                ])

            if (error) throw error

            showAlert?.('Отклик отправлен!')
            setShowApplyForm(false)
            checkMyApplication()
        } catch (error) {
            console.error('Ошибка отправки отклика:', error)
            showAlert?.('Произошла ошибка. Попробуйте снова.')
        }
    }

    const handleAcceptApplication = async (applicationId) => {
        console.log('=== handleAcceptApplication ВЫЗВАНА ===', applicationId)
        try {
            const application = applications.find(app => app.id === applicationId)
            console.log('Найденный отклик:', application)
            if (!application) {
                showAlert?.('Отклик не найден')
                return
            }

            console.log('Показываем confirm...')
            const confirmed = await showConfirm?.(
                'Принять этого исполнителя в работу?'
            )
            console.log('Результат confirm:', confirmed)
            if (!confirmed) {
                console.log('Пользователь отменил')
                return
            }

            console.log('Принимаем исполнителя:', application)

            // Принимаем выбранный отклик
            const { data: acceptData, error: acceptError } = await supabase
                .from('task_applications')
                .update({ status: 'accepted' })
                .eq('id', applicationId)
                .select()

            console.log('Результат принятия отклика:', { acceptData, acceptError })
            if (acceptError) throw acceptError

            // Отклоняем остальные отклики
            const { data: rejectData, error: rejectError } = await supabase
                .from('task_applications')
                .update({ status: 'rejected' })
                .eq('task_id', taskId)
                .neq('id', applicationId)
                .select()

            console.log('Результат отклонения остальных:', { rejectData, rejectError })
            if (rejectError) throw rejectError

            // Устанавливаем дедлайн на выполнение работы (7 дней от сейчас)
            const workDeadline = new Date()
            workDeadline.setDate(workDeadline.getDate() + 7)

            // Обновляем статус задания и записываем исполнителя
            const { data: taskData, error: taskError } = await supabase
                .from('tasks')
                .update({
                    status: 'in_progress',
                    accepted_influencer_id: application.influencer_id,
                    work_deadline: workDeadline.toISOString()
                })
                .eq('id', taskId)
                .select()

            console.log('Результат обновления задания:', { taskData, taskError })
            if (taskError) throw taskError

            showAlert?.('Исполнитель принят! Работа должна быть выполнена до ' + workDeadline.toLocaleDateString('ru'))

            // Перезагружаем данные
            console.log('Перезагружаем данные...')
            await loadTaskDetails()
            await loadApplications()
            console.log('Данные перезагружены')
        } catch (error) {
            console.error('Ошибка при принятии исполнителя:', error)
            showAlert?.(`Ошибка: ${error.message || 'Произошла ошибка'}`)
        }
    }

    const handleCompleteTask = async () => {
        try {
            // Находим принятый отклик для получения цены
            const acceptedApplication = applications.find(app => app.status === 'accepted')
            if (!acceptedApplication) {
                showAlert?.('Не найден принятый отклик')
                return
            }

            const paymentAmount = acceptedApplication.proposed_price || task.budget

            // Проверяем баланс заказчика
            if ((profile.balance || 0) < paymentAmount) {
                const confirmed = await showConfirm?.(
                    `Недостаточно средств на балансе. Требуется ${paymentAmount} сом, доступно ${(profile.balance || 0)} сом. Пополнить баланс?`
                )
                if (confirmed) {
                    navigate('/balance')
                }
                return
            }

            const confirmed = await showConfirm?.(
                `Подтвердить выполнение работы и перевести ${paymentAmount} сом исполнителю?`
            )
            if (!confirmed) return

            // Списываем деньги с заказчика
            const newClientBalance = (profile.balance || 0) - paymentAmount
            const { error: clientBalanceError } = await supabase
                .from('users')
                .update({ balance: newClientBalance })
                .eq('id', profile.id)

            if (clientBalanceError) throw clientBalanceError

            // Переводим деньги исполнителю
            const { data: influencer, error: influencerError } = await supabase
                .from('users')
                .select('balance')
                .eq('id', task.accepted_influencer_id)
                .single()

            if (influencerError) throw influencerError

            const newInfluencerBalance = (influencer.balance || 0) + paymentAmount

            const { error: updateBalanceError } = await supabase
                .from('users')
                .update({ balance: newInfluencerBalance })
                .eq('id', task.accepted_influencer_id)

            if (updateBalanceError) throw updateBalanceError

            // Создаем транзакцию оплаты
            await supabase
                .from('transactions')
                .insert({
                    from_user_id: profile.id,
                    to_user_id: task.accepted_influencer_id,
                    task_id: taskId,
                    amount: paymentAmount,
                    type: 'task_payment',
                    status: 'completed',
                    description: `Оплата за задание: ${task.title}`
                })

            // Завершаем задание
            const { error: taskError } = await supabase
                .from('tasks')
                .update({ status: 'completed' })
                .eq('id', taskId)

            if (taskError) throw taskError

            // Обновляем локальный баланс
            updateProfile({ balance: newClientBalance })

            showAlert?.(`Задание завершено! Исполнителю переведено ${paymentAmount} сом`)
            await loadTaskDetails()
        } catch (error) {
            console.error('Ошибка завершения задания:', error)
            showAlert?.(`Ошибка: ${error.message || 'Произошла ошибка'}`)
        }
    }

    const getStatusBadge = (status) => {
        const badges = {
            pending: { text: '⏳ На рассмотрении', color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200' },
            accepted: { text: '✅ Принят', color: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200' },
            rejected: { text: '❌ Отклонен', color: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200' }
        }
        return badges[status] || { text: status, color: '' }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-tg-hint">Загрузка...</div>
            </div>
        )
    }

    return (
        <div className="min-h-screen pb-6">
            {/* Header */}
            <div className="bg-tg-button text-tg-button-text p-4 sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate(-1)} className="text-2xl">←</button>
                    <h1 className="text-xl font-bold">Детали задания</h1>
                </div>
            </div>

            {/* Task Info */}
            <div className="p-4 space-y-4">
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md">
                    <h2 className="text-2xl font-bold mb-3">{task.title}</h2>

                    <div className="flex items-center gap-2 mb-3 text-sm text-tg-hint">
                        <span>👤 {task.users?.first_name} {task.users?.last_name}</span>
                    </div>

                    <div className="mb-4">
                        <p className="text-lg font-semibold text-tg-button mb-2">
                            💰 {task.budget} сом
                        </p>
                        {task.category && (
                            <span className="inline-block bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full text-sm">
                                {task.category}
                            </span>
                        )}
                    </div>

                    <div className="border-t pt-4">
                        <h3 className="font-semibold mb-2">Описание:</h3>
                        <p className="text-tg-hint whitespace-pre-wrap">{task.description}</p>
                    </div>

                    {task.requirements?.minFollowers && (
                        <div className="border-t pt-4 mt-4">
                            <h3 className="font-semibold mb-2">Требования:</h3>
                            <p className="text-sm text-tg-hint">
                                • Минимум подписчиков: {task.requirements.minFollowers.toLocaleString()}
                            </p>
                        </div>
                    )}

                    {task.deadline && (
                        <div className="border-t pt-4 mt-4">
                            <p className="text-sm text-tg-hint">
                                📅 Дедлайн: {new Date(task.deadline).toLocaleDateString('ru')}
                            </p>
                        </div>
                    )}
                </div>

                {/* For Influencers */}
                {userType === 'influencer' && task.status === 'open' && (
                    <div>
                        {myApplication ? (
                            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="font-semibold">Ваш отклик</h3>
                                    <span className={`text-xs px-2 py-1 rounded-full ${getStatusBadge(myApplication.status).color}`}>
                                        {getStatusBadge(myApplication.status).text}
                                    </span>
                                </div>
                                <p className="text-sm text-tg-hint">{myApplication.message}</p>
                                {myApplication.proposed_price && (
                                    <p className="text-sm font-semibold mt-2">
                                        Предложенная цена: {myApplication.proposed_price} сом
                                    </p>
                                )}
                            </div>
                        ) : showApplyForm ? (
                            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md space-y-3">
                                <h3 className="font-semibold">Откликнуться на задание</h3>
                                <textarea
                                    value={applyMessage}
                                    onChange={(e) => setApplyMessage(e.target.value)}
                                    placeholder="Расскажите, почему вы подходите для этого проекта..."
                                    rows={4}
                                    className="w-full px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-700 outline-none resize-none"
                                />
                                <input
                                    type="number"
                                    value={proposedPrice}
                                    onChange={(e) => setProposedPrice(e.target.value)}
                                    placeholder="Предложите свою цену (опционально)"
                                    className="w-full px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-700 outline-none"
                                />
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleApply}
                                        className="flex-1 bg-tg-button text-tg-button-text py-3 rounded-xl font-semibold"
                                    >
                                        Отправить отклик
                                    </button>
                                    <button
                                        onClick={() => setShowApplyForm(false)}
                                        className="px-4 py-3 rounded-xl bg-gray-200 dark:bg-gray-700"
                                    >
                                        Отмена
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button
                                onClick={() => setShowApplyForm(true)}
                                className="w-full bg-tg-button text-tg-button-text py-4 rounded-xl font-semibold"
                            >
                                Откликнуться
                            </button>
                        )}
                    </div>
                )}

                {/* For Influencers - Work in Progress */}
                {userType === 'influencer' && task.status === 'in_progress' && myApplication?.status === 'accepted' && (
                    <div className="space-y-4">
                        {/* Дедлайн */}
                        {task.work_deadline && (
                            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4">
                                <div className="flex items-center gap-2">
                                    <span className="text-2xl">⏰</span>
                                    <div>
                                        <p className="font-semibold text-yellow-800 dark:text-yellow-200">Срок выполнения</p>
                                        <p className="text-sm text-yellow-700 dark:text-yellow-300">
                                            {new Date(task.work_deadline).toLocaleDateString('ru', {
                                                day: 'numeric',
                                                month: 'long',
                                                year: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Последний отчет */}
                        {submissions.length > 0 && submissions[0].status === 'revision_requested' && (
                            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4">
                                <h4 className="font-semibold text-orange-800 dark:text-orange-200 mb-2">Требуется доработка</h4>
                                <p className="text-sm text-orange-700 dark:text-orange-300">
                                    {submissions[0].revision_comment}
                                </p>
                            </div>
                        )}

                        {/* Форма отправки отчета */}
                        {showSubmissionForm ? (
                            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md space-y-3">
                                <h3 className="font-semibold">Отправить отчет о выполнении</h3>
                                <input
                                    type="url"
                                    value={postUrl}
                                    onChange={(e) => setPostUrl(e.target.value)}
                                    placeholder="Ссылка на пост в Instagram"
                                    className="w-full px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-700 outline-none"
                                />
                                <textarea
                                    value={workDescription}
                                    onChange={(e) => setWorkDescription(e.target.value)}
                                    placeholder="Опишите выполненную работу..."
                                    rows={4}
                                    className="w-full px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-700 outline-none resize-none"
                                />
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleSubmitWork}
                                        className="flex-1 bg-green-600 text-white py-3 rounded-xl font-semibold"
                                    >
                                        Отправить отчет
                                    </button>
                                    <button
                                        onClick={() => setShowSubmissionForm(false)}
                                        className="px-4 py-3 rounded-xl bg-gray-200 dark:bg-gray-700"
                                    >
                                        Отмена
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button
                                onClick={() => setShowSubmissionForm(true)}
                                className="w-full bg-green-600 text-white py-4 rounded-xl font-semibold"
                            >
                                📤 Отправить отчет о выполнении
                            </button>
                        )}

                        {/* История отчетов */}
                        {submissions.length > 0 && (
                            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md">
                                <h4 className="font-semibold mb-3">История отчетов</h4>
                                <div className="space-y-3">
                                    {submissions.map(sub => (
                                        <div key={sub.id} className="border-l-4 pl-3 py-2" style={{
                                            borderColor: sub.status === 'approved' ? '#10b981' :
                                                sub.status === 'revision_requested' ? '#f59e0b' : '#6b7280'
                                        }}>
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-xs text-tg-hint">
                                                    {new Date(sub.submitted_at).toLocaleDateString('ru')}
                                                </span>
                                                <span className={`text-xs px-2 py-1 rounded-full ${sub.status === 'approved' ? 'bg-green-100 text-green-800' :
                                                    sub.status === 'revision_requested' ? 'bg-orange-100 text-orange-800' :
                                                        'bg-gray-100 text-gray-800'
                                                    }`}>
                                                    {sub.status === 'approved' ? '✅ Одобрено' :
                                                        sub.status === 'revision_requested' ? '🔄 На доработке' :
                                                            '⏳ На проверке'}
                                                </span>
                                            </div>
                                            <a href={sub.post_url} target="_blank" rel="noopener noreferrer"
                                                className="text-sm text-tg-link">
                                                Ссылка на пост →
                                            </a>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* For Clients - Applications List */}
                {userType === 'client' && (
                    <div>
                        {/* Submissions Review for In Progress Tasks */}
                        {task.status === 'in_progress' && submissions.length > 0 && (
                            <div className="mb-4 space-y-4">
                                <h3 className="text-lg font-semibold">Отчеты исполнителя</h3>
                                {submissions.filter(sub => sub.status === 'pending').map(sub => (
                                    <div key={sub.id} className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md">
                                        <div className="flex items-center justify-between mb-3">
                                            <h4 className="font-semibold">Новый отчет на проверке</h4>
                                            <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-800">
                                                {new Date(sub.submitted_at).toLocaleDateString('ru')}
                                            </span>
                                        </div>

                                        <div className="mb-3">
                                            <p className="text-sm text-tg-hint mb-2">Ссылка на пост:</p>
                                            <a href={sub.post_url} target="_blank" rel="noopener noreferrer"
                                                className="text-tg-link break-all">
                                                {sub.post_url} →
                                            </a>
                                        </div>

                                        <div className="mb-4">
                                            <p className="text-sm text-tg-hint mb-2">Описание работы:</p>
                                            <p className="text-sm whitespace-pre-wrap">{sub.description}</p>
                                        </div>

                                        <div className="space-y-2">
                                            <button
                                                onClick={() => handleApproveSubmission(sub.id)}
                                                className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition-colors"
                                            >
                                                ✅ Одобрить и оплатить
                                            </button>

                                            <textarea
                                                value={revisionComment}
                                                onChange={(e) => setRevisionComment(e.target.value)}
                                                placeholder="Укажите что нужно доработать..."
                                                rows={3}
                                                className="w-full px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-700 outline-none resize-none text-sm"
                                            />

                                            <button
                                                onClick={() => handleRequestRevision(sub.id)}
                                                className="w-full bg-orange-500 text-white py-3 rounded-xl font-semibold hover:bg-orange-600 transition-colors"
                                            >
                                                🔄 Отправить на доработку
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Applications List */}
                        <h3 className="text-lg font-semibold mb-3">Отклики исполнителей</h3>
                        {applications.length === 0 ? (
                            <div className="text-center py-10 bg-white dark:bg-gray-800 rounded-xl">
                                <p className="text-tg-hint">Пока нет откликов</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {applications.map(app => (
                                    <div key={app.id} className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md">
                                        <div className="flex items-start justify-between mb-3">
                                            <div>
                                                <h4 className="font-semibold">
                                                    {app.users?.first_name} {app.users?.last_name}
                                                </h4>
                                                {app.users?.influencer_profiles?.[0] ? (
                                                    <a
                                                        href={app.users.influencer_profiles[0].instagram_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-tg-link text-sm"
                                                    >
                                                        @{app.users.influencer_profiles[0].instagram_username} →
                                                    </a>
                                                ) : (
                                                    <p className="text-xs text-tg-hint">Профиль Instagram не заполнен</p>
                                                )}
                                            </div>
                                            <span className={`text-xs px-2 py-1 rounded-full ${getStatusBadge(app.status).color}`}>
                                                {getStatusBadge(app.status).text}
                                            </span>
                                        </div>

                                        {/* Instagram Stats */}
                                        {app.users?.influencer_profiles?.[0] ? (
                                            <div className="grid grid-cols-3 gap-2 mb-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                                <div className="text-center">
                                                    <div className="text-xs text-tg-hint">Подписчики</div>
                                                    <div className="font-semibold">
                                                        {app.users.influencer_profiles[0].followers_count?.toLocaleString() || '-'}
                                                    </div>
                                                </div>
                                                <div className="text-center">
                                                    <div className="text-xs text-tg-hint">ER</div>
                                                    <div className="font-semibold">
                                                        {app.users.influencer_profiles[0].engagement_rate || '-'}%
                                                    </div>
                                                </div>
                                                <div className="text-center">
                                                    <div className="text-xs text-tg-hint">Категория</div>
                                                    <div className="font-semibold text-xs">
                                                        {app.users.influencer_profiles[0].category || '-'}
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="mb-3 p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                                                <p className="text-xs text-yellow-800 dark:text-yellow-200">
                                                    ⚠️ Инфлюенсер еще не заполнил профиль Instagram
                                                </p>
                                            </div>
                                        )}

                                        <p className="text-sm text-tg-hint mb-3">{app.message}</p>

                                        {app.proposed_price && (
                                            <p className="text-sm font-semibold mb-3">
                                                Предложенная цена: {app.proposed_price} сом
                                            </p>
                                        )}

                                        {app.status === 'pending' && task.status === 'open' && (
                                            <button
                                                onClick={() => handleAcceptApplication(app.id)}
                                                className="w-full bg-tg-button text-tg-button-text py-2 rounded-lg font-semibold"
                                            >
                                                Принять исполнителя
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>)
}

export default TaskDetails