import { useTelegram } from '../hooks/useTelegram'
import { useNavigate } from 'react-router-dom'
import { isAdmin } from '../lib/telegramBot'

function DebugPage() {
    const { user } = useTelegram()
    const navigate = useNavigate()

    return (
        <div className="min-h-screen p-4 pt-8">
            <div className="max-w-md mx-auto">
                <h1 className="text-2xl font-bold mb-4">🔍 Отладка админа</h1>

                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md mb-4">
                    <h3 className="font-semibold mb-2">Данные пользователя:</h3>
                    <pre className="text-xs bg-gray-100 dark:bg-gray-700 p-2 rounded">
                        {JSON.stringify(user, null, 2)}
                    </pre>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md mb-4">
                    <h3 className="font-semibold mb-2">Проверки:</h3>
                    <p>User ID: <code>{user?.id}</code></p>
                    <p>Ожидаемый Admin ID: <code>7737197594</code></p>
                    <p>ID совпадает: <strong>{user?.id === 7737197594 ? 'ДА' : 'НЕТ'}</strong></p>
                    <p>isAdmin функция: <strong>{user && isAdmin(user.id) ? 'ДА' : 'НЕТ'}</strong></p>
                </div>

                {user && isAdmin(user.id) ? (
                    <button
                        onClick={() => navigate('/admin')}
                        className="w-full bg-red-500 text-white p-4 rounded-xl font-semibold"
                    >
                        🔧 Перейти в Админ-панель
                    </button>
                ) : (
                    <div className="bg-red-100 dark:bg-red-900/30 p-4 rounded-xl text-center">
                        <p className="text-red-800 dark:text-red-200">
                            ❌ Доступ к админ-панели запрещен
                        </p>
                    </div>
                )}

                <button
                    onClick={() => navigate('/')}
                    className="w-full mt-4 bg-gray-500 text-white p-2 rounded-lg"
                >
                    ← Назад
                </button>
            </div>
        </div>
    )
}

export default DebugPage