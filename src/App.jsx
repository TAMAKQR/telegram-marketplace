import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useTelegram } from './hooks/useTelegram'
import { useUserStore } from './store/userStore'
import { supabase } from './lib/supabase'
import UserTypeSelection from './pages/UserTypeSelection'
import ClientDashboard from './pages/ClientDashboard'
import InfluencerDashboard from './pages/InfluencerDashboard'
import CreateTask from './pages/CreateTask'
import EditTask from './pages/EditTask'
import TaskDetails from './pages/TaskDetails'
import InfluencerProfile from './pages/InfluencerProfile'
import BalancePage from './pages/BalancePage'
import WithdrawalPage from './pages/WithdrawalPage'
import SubmitTaskPost from './pages/SubmitTaskPost'
import ReviewSubmission from './pages/ReviewSubmission'
import AdminPanel from './pages/AdminPanel'
import AccountantPanel from './pages/AccountantPanel'
import InstagramCallback from './pages/InstagramCallback'
import InstagramDeauth from './pages/InstagramDeauth'
import InstagramDelete from './pages/InstagramDelete'
import Terms from './pages/Terms'
import Privacy from './pages/Privacy'
import InfluencerGuide from './pages/InfluencerGuide'
import WebAdminSettings from './pages/WebAdminSettings'
import WebClientDashboard from './pages/WebClientDashboard'

// Dev-only pages (keep out of production navigation)
import DebugPage from './pages/_dev/DebugPage'

function AppShell() {
    const location = useLocation()
    const navigate = useNavigate()
    const { user } = useTelegram()
    const { userType, profile, setUserType, setProfile, clearUser } = useUserStore()

    const build = typeof __BUILD_TIMESTAMP__ !== 'undefined' ? __BUILD_TIMESTAMP__ : 'unknown'

    const publicPaths = ['/instagram/callback', '/instagram/index.html', '/instagram/deauth', '/instagram/delete', '/terms', '/privacy', '/guide', '/web-admin', '/web-client']
    const currentPath = location.pathname.replace(/\/$/, '')
    const isPublicPage = publicPaths.some(path => currentPath === path || currentPath.startsWith(path + '/'))

    const [bootstrapping, setBootstrapping] = useState(false)

    // Debug: показываем что происходит
    console.log('App render:', { user, userType, build, telegram: !!window.Telegram?.WebApp })
    console.log('Path check:', { currentPath, isPublicPage, publicPaths, shouldSkipAuth: isPublicPage })

    // Ключевой фикс: Telegram может открыть приложение на последнем маршруте,
    // а zustand store при этом пустой (userType/profile = null). Поэтому всегда
    // подгружаем профиль из Supabase при старте.
    useEffect(() => {
        const bootstrap = async () => {
            if (isPublicPage) return
            if (!user?.id) return

            // Если профиль уже загружен для этого telegram user — ничего не делаем
            if (profile?.telegram_id === user.id && userType) return

            setBootstrapping(true)
            try {
                const { data, error } = await supabase
                    .from('users')
                    .select('*')
                    .eq('telegram_id', user.id)
                    .eq('is_deleted', false)
                    .maybeSingle()

                if (error) throw error

                if (!data) {
                    clearUser?.()
                    if (location.pathname !== '/') navigate('/', { replace: true })
                    return
                }

                setUserType(data.user_type)
                setProfile(data)

                if (data.role === 'accountant' && location.pathname !== '/accountant') {
                    navigate('/accountant', { replace: true })
                    return
                }

                // Если открыли корень — отправляем в нужный дашборд
                if (location.pathname === '/' || location.pathname === '') {
                    navigate(data.user_type === 'client' ? '/client' : '/influencer', { replace: true })
                }
            } catch (e) {
                console.error('Bootstrap user failed:', e)
            } finally {
                setBootstrapping(false)
            }
        }

        bootstrap()
    }, [user?.id, isPublicPage, location.pathname])

    if (!isPublicPage && !user) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-tg-bg">
                <div className="text-center p-4">
                    <h2 className="text-xl font-semibold mb-2">Загрузка...</h2>
                    <p className="text-tg-hint">Откройте это приложение через Telegram</p>
                    <p className="text-xs text-tg-hint mt-4">
                        Build: {String(build)}
                    </p>
                    <p className="text-xs text-tg-hint mt-1">
                        {window.Telegram?.WebApp ? 'Telegram SDK загружен' : 'Ожидание Telegram SDK...'}
                    </p>
                </div>
            </div>
        )
    }

    if (!isPublicPage && user && bootstrapping) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-tg-bg">
                <div className="w-full max-w-sm px-6">
                    {/* Avatar skeleton */}
                    <div className="flex justify-center mb-6">
                        <div className="w-20 h-20 rounded-full skeleton-purple"></div>
                    </div>

                    {/* Name skeleton */}
                    <div className="flex justify-center mb-3">
                        <div className="h-6 w-40 skeleton-purple rounded-lg"></div>
                    </div>

                    {/* Status skeleton */}
                    <div className="flex justify-center mb-8">
                        <div className="h-4 w-28 skeleton-dark rounded-lg"></div>
                    </div>

                    {/* Cards skeleton */}
                    <div className="space-y-3">
                        <div className="h-16 w-full skeleton-purple rounded-xl"></div>
                        <div className="h-16 w-full skeleton-purple rounded-xl"></div>
                        <div className="h-12 w-3/4 mx-auto skeleton-dark rounded-xl"></div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-tg-bg app-shell pb-safe">
            <Routes>
                {/* Юридические страницы - доступны без авторизации */}
                <Route path="/terms" element={<Terms />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/guide" element={<InfluencerGuide />} />

                {/* Веб-панель админа - доступна через браузер */}
                <Route path="/web-admin" element={<WebAdminSettings />} />

                {/* Веб-кабинет заказчика - доступен через браузер */}
                <Route path="/web-client" element={<WebClientDashboard />} />

                {/* OAuth Callbacks - доступны без авторизации */}
                <Route path="/instagram/callback" element={<InstagramCallback />} />
                <Route path="/instagram/index.html" element={<InstagramCallback />} />
                <Route path="/instagram/deauth" element={<InstagramDeauth />} />
                <Route path="/instagram/delete" element={<InstagramDelete />} />

                {/* Все остальные маршруты требуют авторизации */}
                {user ? (
                    <>
                        <Route path="/" element={
                            userType ? (
                                userType === 'client' ?
                                    <Navigate to="/client" replace /> :
                                    <Navigate to="/influencer" replace />
                            ) : (
                                <UserTypeSelection />
                            )
                        } />

                        {/* Маршруты для заказчиков */}
                        <Route path="/client" element={<ClientDashboard />} />
                        <Route path="/client/create-task" element={<CreateTask />} />
                        <Route path="/edit-task/:taskId" element={<EditTask />} />
                        <Route path="/client/task/:taskId" element={<TaskDetails />} />
                        <Route path="/client/task/:taskId/review" element={<ReviewSubmission />} />

                        {/* Маршруты для инфлюенсеров */}
                        <Route path="/influencer" element={<InfluencerDashboard />} />
                        <Route path="/influencer/profile" element={<InfluencerProfile />} />
                        <Route path="/influencer/task/:taskId" element={<TaskDetails />} />
                        <Route path="/influencer/task/:taskId/submit" element={<SubmitTaskPost />} />

                        {/* Общие маршруты */}
                        <Route path="/balance" element={<BalancePage />} />
                        <Route path="/withdrawal" element={<WithdrawalPage />} />

                        {/* Админская панель */}
                        <Route path="/admin" element={<AdminPanel />} />
                        <Route path="/accountant" element={<AccountantPanel />} />

                        {/* Отладочная страница */}
                        {import.meta.env.DEV && <Route path="/debug" element={<DebugPage />} />}

                        <Route path="*" element={<Navigate to="/" replace />} />
                    </>
                ) : (
                    <Route path="*" element={
                        <div className="flex items-center justify-center min-h-screen bg-tg-bg">
                            <div className="text-center p-4">
                                <h2 className="text-xl font-semibold mb-2">Требуется авторизация</h2>
                                <p className="text-tg-hint">Откройте это приложение через Telegram</p>
                            </div>
                        </div>
                    } />
                )}
            </Routes>
            <div className="bottom-fade" aria-hidden="true" />
        </div>
    )
}

function App() {
    return (
        <BrowserRouter>
            <AppShell />
        </BrowserRouter>
    )
}

export default App
