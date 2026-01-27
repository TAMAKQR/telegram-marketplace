import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useUserStore } from '../store/userStore'
import { useTelegram } from '../hooks/useTelegram'
import { sendTelegramNotification, formatCompletedTaskMessage } from '../lib/telegramBot'
import Logo from '../components/Logo'
import InstagramStats from '../components/InstagramStats'

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
    const [showApplyForm, setShowApplyForm] = useState(false)
    const [meetsRequirements, setMeetsRequirements] = useState(true)
    const [requirementDetails, setRequirementDetails] = useState(null)

    // Состояния для отчетов
    const [submissions, setSubmissions] = useState([])
    const [showSubmissionForm, setShowSubmissionForm] = useState(false)
    const [postUrl, setPostUrl] = useState('')
    const [workDescription, setWorkDescription] = useState('')
    const [userPosts, setUserPosts] = useState([])
    const [loadingPosts, setLoadingPosts] = useState(false)
    const [selectedPost, setSelectedPost] = useState(null)

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

            // Проверяем соответствие критериям для инфлюенсера
            if (userType === 'influencer') {
                await checkRequirements(data)
            }
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
            }
        } catch (error) {
            console.log('Нет отклика на это задание')
        }
    }

    const checkRequirements = async (taskData) => {
        if (!taskData?.requirements || userType !== 'influencer') {
            setMeetsRequirements(true)
            return
        }

        try {
            // Получаем профиль инфлюенсера
            const { data: influencerProfile, error } = await supabase
                .from('influencer_profiles')
                .select('followers_count, engagement_rate')
                .eq('user_id', profile.id)
                .single()

            if (error || !influencerProfile) {
                setMeetsRequirements(false)
                setRequirementDetails({ error: 'Профиль инфлюенсера не найден' })
                return
            }

            const requirements = taskData.requirements
            const meetsFollowers = !requirements.minFollowers || (influencerProfile.followers_count >= requirements.minFollowers)
            const meetsEngagement = !requirements.minEngagementRate || (parseFloat(influencerProfile.engagement_rate) >= requirements.minEngagementRate)

            setMeetsRequirements(meetsFollowers && meetsEngagement)
            setRequirementDetails({
                minFollowers: requirements.minFollowers,
                currentFollowers: influencerProfile.followers_count,
                meetsFollowers,
                minEngagementRate: requirements.minEngagementRate,
                currentEngagementRate: parseFloat(influencerProfile.engagement_rate),
                meetsEngagement
            })
        } catch (error) {
            console.error('Ошибка проверки критериев:', error)
            setMeetsRequirements(false)
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

            console.log('Загружены submissions:', data)
            console.log('Активные submissions:', data?.filter(sub => ['pending', 'in_progress'].includes(sub.status)))
            setSubmissions(data || [])
        } catch (error) {
            console.error('Ошибка загрузки отчетов:', error)
        }
    }

    const loadUserPosts = async () => {
        console.log('loadUserPosts вызвана')
        setLoadingPosts(true)
        try {
            console.log('Получение профиля инфлюенсера...')
            // Получаем профиль инфлюенсера с токеном Instagram и user_id
            const { data: influencerProfile, error: profileError } = await supabase
                .from('influencer_profiles')
                .select('instagram_access_token, instagram_user_id')
                .eq('user_id', profile.id)
                .single()

            console.log('Профиль инфлюенсера:', influencerProfile)
            if (profileError) {
                console.error('Ошибка получения профиля:', profileError)
                throw profileError
            }

            if (!influencerProfile?.instagram_access_token) {
                console.log('Нет токена Instagram')
                showAlert?.('Необходимо подключить Instagram аккаунт')
                return
            }

            if (!influencerProfile?.instagram_user_id) {
                console.log('Нет Instagram User ID')
                showAlert?.('Пожалуйста, переподключите Instagram аккаунт')
                return
            }

            console.log('Вызов fetch_user_instagram_media...')
            // Вызываем функцию для получения списка медиа
            const { data, error } = await supabase
                .rpc('fetch_user_instagram_media', {
                    p_access_token: influencerProfile.instagram_access_token,
                    p_instagram_user_id: influencerProfile.instagram_user_id,
                    p_limit: 25
                })

            console.log('Ответ от RPC:', { data, error })
            if (error) {
                console.error('Ошибка RPC:', error)
                throw error
            }

            // Проверяем, есть ли ошибка от Instagram API
            if (data?.error) {
                console.error('Ошибка Instagram API:', data)

                // Парсим сообщение об ошибке
                let errorMessage = 'Ошибка загрузки постов из Instagram'
                try {
                    const errorData = JSON.parse(data.message)
                    if (errorData.error?.message) {
                        errorMessage = errorData.error.message

                        // Если токен невалидный - показываем понятное сообщение
                        if (errorData.error.code === 190 || errorMessage.includes('Invalid OAuth')) {
                            errorMessage = 'Токен Instagram истек. Пожалуйста, переподключите Instagram в настройках профиля.'
                        }
                    }
                } catch (e) {
                    errorMessage = data.message || errorMessage
                }

                showAlert?.(errorMessage)
                return
            }

            if (data?.data) {
                console.log('Найдено постов:', data.data.length)
                setUserPosts(data.data)
            } else {
                console.log('Нет постов в ответе, полный ответ:', data)
                showAlert?.('Не найдено постов в Instagram')
                setUserPosts([])
            }
        } catch (error) {
            console.error('Ошибка загрузки постов:', error)
            showAlert?.('Не удалось загрузить ваши посты из Instagram: ' + error.message)
        } finally {
            setLoadingPosts(false)
        }
    }

    const handleSubmitWork = async () => {
        if (!postUrl.trim() || !workDescription.trim()) {
            showAlert?.('Заполните все поля: ссылка на пост и описание работы')
            return
        }

        // Валидация формата Instagram ссылки
        const instagramUrlPattern = /instagram\.com\/(p|reel)\/[A-Za-z0-9_-]+/
        if (!instagramUrlPattern.test(postUrl)) {
            showAlert?.('❌ Неверный формат ссылки!\n\nИспользуйте ссылку из Instagram:\n• instagram.com/p/...\n• instagram.com/reel/...\n\nКак скопировать:\n1. Откройте пост в Instagram\n2. Три точки (•••)\n3. "Копировать ссылку"')
            return
        }

        try {
            // Проверяем, нет ли уже активного submission (на проверке или в работе)
            const { data: existingSubmissions, error: checkError } = await supabase
                .from('task_submissions')
                .select('id, status')
                .eq('task_id', taskId)
                .eq('influencer_id', profile.id)
                .in('status', ['pending', 'in_progress'])

            if (checkError) throw checkError

            if (existingSubmissions && existingSubmissions.length > 0) {
                const status = existingSubmissions[0].status
                const statusText = status === 'pending' ? 'на проверке' : 'в работе'
                showAlert?.(`⚠️ У вас уже есть отчет ${statusText}\n\nМожно отправить новый только после одобрения или отклонения предыдущего.`)
                return
            }

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

            showAlert?.('✅ Отчет отправлен!\n\nМетрики будут автоматически отслеживаться каждый час. Оплата произойдет при достижении целей.')
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

    const handleApply = async () => {
        if (!applyMessage.trim()) {
            showAlert?.('Напишите сопроводительное сообщение')
            return
        }

        // Проверка соответствия критериям
        if (!meetsRequirements) {
            showAlert?.('Вы не соответствуете требованиям заказчика')
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

            // Проверяем лимит инфлюенсеров если задан
            if (task.max_influencers && task.accepted_count >= task.max_influencers) {
                showAlert?.(`Достигнут лимит исполнителей (${task.max_influencers})`)
                return
            }

            // Принимаем выбранный отклик
            const { data: acceptData, error: acceptError } = await supabase
                .from('task_applications')
                .update({ status: 'accepted' })
                .eq('id', applicationId)
                .select()

            console.log('Результат принятия отклика:', { acceptData, acceptError })
            if (acceptError) throw acceptError

            // НЕ отклоняем остальные отклики - один заказ могут брать много инфлюенсеров

            // Обновляем задание - меняем статус на in_progress если это первый принятый
            const updateData = { status: 'in_progress' }

            const { data: taskData, error: taskError } = await supabase
                .from('tasks')
                .update(updateData)
                .eq('id', taskId)
                .select()

            console.log('Результат обновления задания:', { taskData, taskError })
            if (taskError) throw taskError

            showAlert?.('Исполнитель принят!')

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

            const paymentAmount = task.budget

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
        <div className="min-h-screen pb-6 overflow-x-hidden">
            {/* Header */}
            <div className="bg-brand-gradient text-white p-4 pt-8">
                <div className="flex items-center gap-3 mb-2">
                    <Logo className="h-7 w-auto" />
                    <button onClick={() => navigate(-1)} className="text-2xl">←</button>
                    <h1 className="text-xl font-bold flex-1">Детали задания</h1>
                    {(() => {
                        // Показываем кнопку редактирования для всех статусов
                        // На странице EditTask будет ограничение: редактировать можно только open/in_progress, удалять - любой
                        const canEdit = userType === 'client' && profile?.id === task?.client_id
                        console.log('Edit button check:', { userType, profileId: profile?.id, clientId: task?.client_id, status: task?.status, canEdit })
                        return canEdit ? (
                            <button
                                onClick={() => navigate(`/edit-task/${taskId}`)}
                                className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-sm"
                            >
                                ✏️ Редактировать
                            </button>
                        ) : null
                    })()}
                </div>
            </div>

            {/* Task Info */}
            <div className="p-4 space-y-4">
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md">
                    <h2 className="text-2xl font-bold mb-3 break-words">{task.title}</h2>

                    <div className="flex items-center gap-2 mb-3 text-sm text-tg-hint">
                        <span>👤 {task.users?.first_name} {task.users?.last_name}</span>
                    </div>

                    <div className="mb-4">
                        <p className="text-lg font-semibold text-tg-button mb-2">
                            💰 {task.budget} сом
                        </p>
                    </div>

                    <div className="border-t pt-4">
                        <h3 className="font-semibold mb-2">Описание:</h3>
                        <p className="text-tg-hint whitespace-pre-wrap break-words">{task.description}</p>
                    </div>

                    {(task.requirements?.minFollowers || task.requirements?.minEngagementRate) && (
                        <div className="border-t pt-4 mt-4">
                            <h3 className="font-semibold mb-2">Требования:</h3>
                            {task.requirements.minFollowers && (
                                <p className="text-sm text-tg-hint">
                                    • Минимум подписчиков: {task.requirements.minFollowers.toLocaleString()}
                                </p>
                            )}
                            {task.requirements.minEngagementRate && (
                                <p className="text-sm text-tg-hint">
                                    • Минимальная вовлеченность: {task.requirements.minEngagementRate}%
                                </p>
                            )}
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
                                <p className="text-sm text-tg-hint break-words">{myApplication.message}</p>
                            </div>
                        ) : showApplyForm ? (
                            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md space-y-3">
                                <h3 className="font-semibold">Откликнуться на задание</h3>

                                {!meetsRequirements && requirementDetails && (
                                    <div className="bg-red-100 dark:bg-red-900/30 border border-red-500 rounded-lg p-3 text-sm">
                                        <p className="font-semibold text-red-800 dark:text-red-200 mb-2">❌ Вы не соответствуете требованиям:</p>
                                        {requirementDetails.minFollowers && !requirementDetails.meetsFollowers && (
                                            <p className="text-red-700 dark:text-red-300">
                                                • Подписчиков: {requirementDetails.currentFollowers} (нужно {requirementDetails.minFollowers})
                                            </p>
                                        )}
                                        {requirementDetails.minEngagementRate && !requirementDetails.meetsEngagement && (
                                            <p className="text-red-700 dark:text-red-300">
                                                • Вовлеченность: {requirementDetails.currentEngagementRate}% (нужно {requirementDetails.minEngagementRate}%)
                                            </p>
                                        )}
                                    </div>
                                )}

                                {meetsRequirements && requirementDetails && (requirementDetails.minFollowers || requirementDetails.minEngagementRate) && (
                                    <div className="bg-green-100 dark:bg-green-900/30 border border-green-500 rounded-lg p-3 text-sm">
                                        <p className="font-semibold text-green-800 dark:text-green-200 mb-2">✅ Вы соответствуете требованиям:</p>
                                        {requirementDetails.minFollowers && (
                                            <p className="text-green-700 dark:text-green-300">
                                                • Подписчиков: {requirementDetails.currentFollowers} ≥ {requirementDetails.minFollowers}
                                            </p>
                                        )}
                                        {requirementDetails.minEngagementRate && (
                                            <p className="text-green-700 dark:text-green-300">
                                                • Вовлеченность: {requirementDetails.currentEngagementRate}% ≥ {requirementDetails.minEngagementRate}%
                                            </p>
                                        )}
                                    </div>
                                )}

                                <textarea
                                    value={applyMessage}
                                    onChange={(e) => setApplyMessage(e.target.value)}
                                    placeholder="Расскажите, почему вы подходите для этого проекта..."
                                    rows={4}
                                    className="w-full px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-700 outline-none resize-none"
                                    disabled={!meetsRequirements}
                                />
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleApply}
                                        disabled={!meetsRequirements}
                                        className="flex-1 bg-tg-button text-tg-button-text py-3 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
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
                        {task.deadline && (
                            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4">
                                <div className="flex items-center gap-2">
                                    <span className="text-2xl">⏰</span>
                                    <div>
                                        <p className="font-semibold text-yellow-800 dark:text-yellow-200">Срок выполнения</p>
                                        <p className="text-sm text-yellow-700 dark:text-yellow-300">
                                            {new Date(task.deadline).toLocaleDateString('ru', {
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

                                {/* Кнопка загрузки постов */}
                                {userPosts.length === 0 && !loadingPosts && (
                                    <button
                                        type="button"
                                        onClick={loadUserPosts}
                                        className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 rounded-xl font-semibold hover:opacity-90"
                                    >
                                        📸 Загрузить мои посты из Instagram
                                    </button>
                                )}

                                {loadingPosts && (
                                    <div className="text-center py-4">
                                        <p className="text-tg-hint">Загрузка постов...</p>
                                    </div>
                                )}

                                {/* Выбор поста из списка */}
                                {userPosts.length > 0 && (
                                    <div>
                                        <label className="block text-sm font-medium mb-2">
                                            Выберите публикацию *
                                        </label>
                                        <div className="grid grid-cols-3 gap-2 max-h-96 overflow-y-auto">
                                            {userPosts.map(post => (
                                                <div
                                                    key={post.id}
                                                    onClick={() => {
                                                        setSelectedPost(post)
                                                        setPostUrl(post.permalink)
                                                    }}
                                                    className={`cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${selectedPost?.id === post.id
                                                        ? 'border-tg-button shadow-lg scale-105'
                                                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-400'
                                                        }`}
                                                >
                                                    <div className="aspect-square relative">
                                                        <img
                                                            src={post.media_type === 'VIDEO' ? post.thumbnail_url : post.media_url}
                                                            alt={post.caption?.substring(0, 50)}
                                                            className="w-full h-full object-cover"
                                                        />
                                                        {post.media_type === 'VIDEO' && (
                                                            <div className="absolute top-1 right-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                                                                ▶️
                                                            </div>
                                                        )}
                                                        {post.media_type === 'CAROUSEL_ALBUM' && (
                                                            <div className="absolute top-1 right-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                                                                📚
                                                            </div>
                                                        )}
                                                        {selectedPost?.id === post.id && (
                                                            <div className="absolute inset-0 bg-tg-button/20 flex items-center justify-center">
                                                                <span className="text-3xl">✓</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="text-xs p-1 bg-gray-50 dark:bg-gray-900 truncate">
                                                        {new Date(post.timestamp).toLocaleDateString('ru')}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        {selectedPost && (
                                            <p className="text-xs text-tg-hint mt-2">
                                                Выбрано: {selectedPost.caption?.substring(0, 100) || 'Без описания'}...
                                            </p>
                                        )}
                                    </div>
                                )}

                                {/* Ручной ввод ссылки (опционально) */}
                                {userPosts.length > 0 && (
                                    <div className="text-center">
                                        <button
                                            type="button"
                                            onClick={() => setUserPosts([])}
                                            className="text-xs text-tg-hint hover:text-tg-button"
                                        >
                                            или ввести ссылку вручную
                                        </button>
                                    </div>
                                )}

                                {userPosts.length === 0 && !loadingPosts && (
                                    <div>
                                        <label className="block text-sm font-medium mb-1">
                                            Ссылка на Instagram пост *
                                        </label>
                                        <input
                                            type="url"
                                            value={postUrl}
                                            onChange={(e) => setPostUrl(e.target.value)}
                                            placeholder="https://www.instagram.com/p/... или https://www.instagram.com/reel/..."
                                            className="w-full px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-700 outline-none"
                                        />
                                        {postUrl && !postUrl.match(/instagram\.com\/(p|reel)\/[A-Za-z0-9_-]+/) && (
                                            <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                                                ⚠️ Неверный формат ссылки. Используйте ссылку вида: instagram.com/p/... или instagram.com/reel/...
                                            </p>
                                        )}
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-medium mb-1">
                                        Описание работы *
                                    </label>
                                    <textarea
                                        value={workDescription}
                                        onChange={(e) => setWorkDescription(e.target.value)}
                                        placeholder="Опишите что вы сделали и какие результаты ожидаете..."
                                        rows={4}
                                        className="w-full px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-700 outline-none resize-none"
                                    />
                                </div>
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
                            <>
                                {/* Проверяем, есть ли активный submission */}
                                {submissions.some(sub => ['pending', 'in_progress'].includes(sub.status)) ? (
                                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4">
                                        <div className="flex items-start gap-3">
                                            <span className="text-2xl">⏳</span>
                                            <div>
                                                <h4 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-1">
                                                    Отчет на проверке
                                                </h4>
                                                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                                                    Вы уже отправили отчет. Дождитесь его проверки заказчиком, прежде чем отправлять новый.
                                                </p>
                                            </div>
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
                            </>
                        )}

                        {/* История отчетов и прогресс метрик */}
                        {submissions.length > 0 && (
                            <div className="space-y-4">
                                {/* Прогресс метрик для активных submission */}
                                {submissions.filter(sub => ['in_progress', 'approved'].includes(sub.status)).map(sub => (
                                    task.target_metrics && (
                                        <div key={`progress-${sub.id}`} className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md">
                                            <div className="flex items-center justify-between mb-3">
                                                <h4 className="font-semibold">📊 Прогресс метрик</h4>
                                                <span className="text-xs px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                                                    В процессе
                                                </span>
                                            </div>

                                            <div className="mb-3">
                                                <a href={sub.post_url} target="_blank" rel="noopener noreferrer"
                                                    className="text-tg-link text-sm break-all block">
                                                    {sub.post_url} →
                                                </a>
                                            </div>

                                            <div className="space-y-3">
                                                {task.target_metrics.views && (
                                                    <div>
                                                        <div className="flex justify-between text-sm mb-1">
                                                            <span>👁️ Просмотры</span>
                                                            <span>{(sub.current_metrics?.views || 0).toLocaleString()} / {task.target_metrics.views.toLocaleString()}</span>
                                                        </div>
                                                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                                            <div
                                                                className="bg-blue-500 h-2 rounded-full transition-all"
                                                                style={{ width: `${Math.min(((sub.current_metrics?.views || 0) / task.target_metrics.views) * 100, 100)}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                )}

                                                {task.target_metrics.likes && (
                                                    <div>
                                                        <div className="flex justify-between text-sm mb-1">
                                                            <span>❤️ Лайки</span>
                                                            <span>{(sub.current_metrics?.likes || 0).toLocaleString()} / {task.target_metrics.likes.toLocaleString()}</span>
                                                        </div>
                                                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                                            <div
                                                                className="bg-pink-500 h-2 rounded-full transition-all"
                                                                style={{ width: `${Math.min(((sub.current_metrics?.likes || 0) / task.target_metrics.likes) * 100, 100)}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                )}

                                                {task.target_metrics.comments && (
                                                    <div>
                                                        <div className="flex justify-between text-sm mb-1">
                                                            <span>💬 Комментарии</span>
                                                            <span>{(sub.current_metrics?.comments || 0).toLocaleString()} / {task.target_metrics.comments.toLocaleString()}</span>
                                                        </div>
                                                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                                            <div
                                                                className="bg-green-500 h-2 rounded-full transition-all"
                                                                style={{ width: `${Math.min(((sub.current_metrics?.comments || 0) / task.target_metrics.comments) * 100, 100)}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            <p className="text-xs text-tg-hint mt-3">
                                                📈 Считается прирост с момента отправки публикации. Обновление каждый час.
                                            </p>
                                        </div>
                                    )
                                ))}

                                {/* История всех отчетов */}
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
                                                            sub.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                                                                'bg-gray-100 text-gray-800'
                                                        }`}>
                                                        {sub.status === 'approved' ? '✅ Одобрено' :
                                                            sub.status === 'revision_requested' ? '🔄 На доработке' :
                                                                sub.status === 'in_progress' ? '📊 Отслеживается' :
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
                            </div>
                        )}
                    </div>
                )}

                {/* For Clients - Applications List */}
                {userType === 'client' && (
                    <div>
                        {/* Уведомление о публикации на проверке */}
                        {submissions.some(sub => sub.status === 'pending') && (
                            <div className="mb-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <span className="text-2xl">📤</span>
                                        <div>
                                            <h3 className="font-semibold text-yellow-900 dark:text-yellow-200">
                                                Новая публикация на проверке
                                            </h3>
                                            <p className="text-sm text-yellow-700 dark:text-yellow-300">
                                                Инфлюенсер отправил ссылку на публикацию
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => navigate(`/client/task/${taskId}/review`)}
                                    className="w-full bg-yellow-500 text-white py-3 rounded-xl font-semibold hover:bg-yellow-600"
                                >
                                    🔍 Проверить публикацию
                                </button>
                            </div>
                        )}

                        {/* Отображение прогресса отслеживания метрик */}
                        {task.status === 'in_progress' && submissions.some(sub => ['pending', 'in_progress', 'approved'].includes(sub.status)) && (
                            <div className="mb-4">
                                <h3 className="text-lg font-semibold mb-3">Прогресс выполнения</h3>
                                {submissions.filter(sub => ['pending', 'in_progress', 'approved'].includes(sub.status)).map(sub => (
                                    <div key={sub.id} className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md">
                                        <div className="flex items-center justify-between mb-3">
                                            <h4 className="font-semibold">Отслеживание метрик</h4>
                                            <span className="text-xs px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                                                В процессе
                                            </span>
                                        </div>

                                        <div className="mb-3">
                                            <p className="text-sm text-tg-hint mb-2">Ссылка на публикацию:</p>
                                            <a href={sub.post_url} target="_blank" rel="noopener noreferrer"
                                                className="text-tg-link break-all text-sm block">
                                                {sub.post_url} →
                                            </a>
                                        </div>

                                        {task.target_metrics && (
                                            <div className="space-y-3">
                                                {task.target_metrics.views && (
                                                    <div>
                                                        <div className="flex justify-between text-sm mb-1">
                                                            <span>👁️ Просмотры</span>
                                                            <span>{(sub.current_metrics?.views || 0).toLocaleString()} / {task.target_metrics.views.toLocaleString()}</span>
                                                        </div>
                                                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                                            <div
                                                                className="bg-blue-500 h-2 rounded-full transition-all"
                                                                style={{ width: `${Math.min(((sub.current_metrics?.views || 0) / task.target_metrics.views) * 100, 100)}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                )}

                                                {task.target_metrics.likes && (
                                                    <div>
                                                        <div className="flex justify-between text-sm mb-1">
                                                            <span>❤️ Лайки</span>
                                                            <span>{(sub.current_metrics?.likes || 0).toLocaleString()} / {task.target_metrics.likes.toLocaleString()}</span>
                                                        </div>
                                                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                                            <div
                                                                className="bg-pink-500 h-2 rounded-full transition-all"
                                                                style={{ width: `${Math.min(((sub.current_metrics?.likes || 0) / task.target_metrics.likes) * 100, 100)}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                )}

                                                {task.target_metrics.comments && (
                                                    <div>
                                                        <div className="flex justify-between text-sm mb-1">
                                                            <span>💬 Комментарии</span>
                                                            <span>{(sub.current_metrics?.comments || 0).toLocaleString()} / {task.target_metrics.comments.toLocaleString()}</span>
                                                        </div>
                                                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                                            <div
                                                                className="bg-green-500 h-2 rounded-full transition-all"
                                                                style={{ width: `${Math.min(((sub.current_metrics?.comments || 0) / task.target_metrics.comments) * 100, 100)}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        <p className="text-xs text-tg-hint mt-3">
                                            Метрики обновляются автоматически каждый час
                                        </p>
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
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-semibold truncate">
                                                    {app.users?.first_name} {app.users?.last_name}
                                                </h4>
                                                {app.users?.influencer_profiles?.[0] ? (
                                                    <a
                                                        href={app.users.influencer_profiles[0].instagram_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-tg-link text-sm break-all"
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

                                        {app.message && app.message.trim() && (
                                            <p className="text-sm text-tg-hint mb-3 break-words">{app.message}</p>
                                        )}

                                        {/* Реальная статистика Instagram */}
                                        {app.users?.influencer_profiles?.[0] ? (
                                            <InstagramStats
                                                influencerProfile={app.users.influencer_profiles[0]}
                                                compact={true}
                                            />
                                        ) : (
                                            <div className="mb-3 p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                                                <p className="text-xs text-yellow-800 dark:text-yellow-200">
                                                    ⚠️ Инфлюенсер еще не заполнил профиль Instagram
                                                </p>
                                            </div>
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