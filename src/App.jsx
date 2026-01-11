import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useTelegram } from './hooks/useTelegram'
import { useUserStore } from './store/userStore'
import UserTypeSelection from './pages/UserTypeSelection'
import ClientDashboard from './pages/ClientDashboard'
import InfluencerDashboard from './pages/InfluencerDashboard'
import CreateTask from './pages/CreateTask'
import TaskDetails from './pages/TaskDetails'
import InfluencerProfile from './pages/InfluencerProfile'
import BalancePage from './pages/BalancePage'

function App() {
    const { user } = useTelegram()
    const { userType } = useUserStore()

    if (!user) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <h2 className="text-xl font-semibold mb-2">Загрузка...</h2>
                    <p className="text-tg-hint">Откройте это приложение через Telegram</p>
                </div>
            </div>
        )
    }

    return (
        <BrowserRouter>
            <div className="min-h-screen bg-tg-bg">
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
                    <Route path="/client/task/:taskId" element={<TaskDetails />} />

                    {/* Маршруты для инфлюенсеров */}
                    <Route path="/influencer" element={<InfluencerDashboard />} />
                    <Route path="/influencer/profile" element={<InfluencerProfile />} />
                    <Route path="/influencer/task/:taskId" element={<TaskDetails />} />

                    {/* Общие маршруты */}
                    <Route path="/balance" element={<BalancePage />} />

                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </div>
        </BrowserRouter>
    )
}

export default App
