import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useTelegram } from './hooks/useTelegram'
import { useUserStore } from './store/userStore'
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
import DebugPage from './pages/DebugPage'
import InstagramCallback from './pages/InstagramCallback'
import InstagramDeauth from './pages/InstagramDeauth'
import InstagramDelete from './pages/InstagramDelete'
import Terms from './pages/Terms'
import Privacy from './pages/Privacy'

function App() {
    const { user } = useTelegram()
    const { userType } = useUserStore()

    // Debug: показываем что происходит
    console.log('App render:', { user, userType, telegram: window.Telegram?.WebApp })

    // Проверяем, находимся ли мы на странице без авторизации
    const publicPaths = ['/instagram/callback', '/instagram/deauth', '/instagram/delete', '/terms', '/privacy']
    const isPublicPage = publicPaths.includes(window.location.pathname)

    if (!user && !isPublicPage) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-tg-bg">
                <div className="text-center p-4">
                    <h2 className="text-xl font-semibold mb-2">Загрузка...</h2>
                    <p className="text-tg-hint">Откройте это приложение через Telegram</p>
                    <p className="text-xs text-tg-hint mt-4">
                        {window.Telegram?.WebApp ? 'Telegram SDK загружен' : 'Ожидание Telegram SDK...'}
                    </p>
                </div>
            </div>
        )
    }

    return (
        <BrowserRouter>
            <div className="min-h-screen bg-tg-bg app-shell pb-safe">
                <Routes>
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

                    {/* OAuth Callbacks */}
                    <Route path="/instagram/callback" element={<InstagramCallback />} />
                    <Route path="/instagram/deauth" element={<InstagramDeauth />} />
                    <Route path="/instagram/delete" element={<InstagramDelete />} />

                    {/* Общие маршруты */}
                    <Route path="/balance" element={<BalancePage />} />
                    <Route path="/withdrawal" element={<WithdrawalPage />} />

                    {/* Админская панель */}
                    <Route path="/admin" element={<AdminPanel />} />
                    <Route path="/accountant" element={<AccountantPanel />} />

                    {/* Юридические страницы */}
                    <Route path="/terms" element={<Terms />} />
                    <Route path="/privacy" element={<Privacy />} />

                    {/* Отладочная страница */}
                    <Route path="/debug" element={<DebugPage />} />

                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
                {/* Visual bottom fade overlay (non-interactive) */}
                <div className="bottom-fade" aria-hidden="true" />
            </div>
        </BrowserRouter>
    )
}

export default App
