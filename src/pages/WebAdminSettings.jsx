import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Logo from '../components/Logo'

// Учётные данные для веб-доступа (в продакшене лучше хранить в env)
const WEB_ADMIN_LOGIN = 'Daison'
const WEB_ADMIN_PASSWORD = 'Production'

function WebAdminSettings() {
    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [login, setLogin] = useState('')
    const [password, setPassword] = useState('')
    const [authError, setAuthError] = useState('')

    const [loading, setLoading] = useState(false)
    const [settings, setSettings] = useState({})
    const [saveStatus, setSaveStatus] = useState('')

    // Проверяем сохранённую сессию
    useEffect(() => {
        const savedAuth = sessionStorage.getItem('webAdminAuth')
        if (savedAuth === 'true') {
            setIsAuthenticated(true)
            loadSettings()
        }
    }, [])

    const handleLogin = (e) => {
        e.preventDefault()

        if (login === WEB_ADMIN_LOGIN && password === WEB_ADMIN_PASSWORD) {
            setIsAuthenticated(true)
            sessionStorage.setItem('webAdminAuth', 'true')
            setAuthError('')
            loadSettings()
        } else {
            setAuthError('Неверный логин или пароль')
        }
    }

    const handleLogout = () => {
        setIsAuthenticated(false)
        sessionStorage.removeItem('webAdminAuth')
        setLogin('')
        setPassword('')
    }

    const loadSettings = async () => {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('app_settings')
                .select('*')

            if (error) throw error

            const settingsObj = {}
            data?.forEach(row => {
                settingsObj[row.key] = {
                    value: row.value,
                    description: row.description,
                    updated_at: row.updated_at
                }
            })
            setSettings(settingsObj)
        } catch (error) {
            console.error('Ошибка загрузки настроек:', error)
        } finally {
            setLoading(false)
        }
    }

    const toggleMetricsMode = async () => {
        const currentMode = settings.instagram_metrics_mode?.value || 'auto'
        const newMode = currentMode === 'auto' ? 'manual' : 'auto'

        try {
            setSaveStatus('Сохранение...')

            const { error } = await supabase.rpc('set_app_setting', {
                p_key: 'instagram_metrics_mode',
                p_value: JSON.stringify(newMode),
                p_admin_telegram_id: null
            })

            if (error) throw error

            setSettings({
                ...settings,
                instagram_metrics_mode: {
                    ...settings.instagram_metrics_mode,
                    value: newMode,
                    updated_at: new Date().toISOString()
                }
            })

            setSaveStatus(`✅ Режим изменён на: ${newMode === 'auto' ? 'Автоматический' : 'Ручной'}`)
            setTimeout(() => setSaveStatus(''), 3000)
        } catch (error) {
            console.error('Ошибка изменения настройки:', error)
            setSaveStatus('❌ Ошибка сохранения')
        }
    }

    // Форма авторизации
    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
                    <div className="text-center mb-8">
                        <Logo className="h-12 mx-auto mb-4" />
                        <h1 className="text-2xl font-bold text-gray-800">🔐 Админ-панель</h1>
                        <p className="text-gray-500 mt-2">Настройки платформы</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Логин
                            </label>
                            <input
                                type="text"
                                value={login}
                                onChange={(e) => setLogin(e.target.value)}
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Введите логин"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Пароль
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Введите пароль"
                                required
                            />
                        </div>

                        {authError && (
                            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
                                {authError}
                            </div>
                        )}

                        <button
                            type="submit"
                            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                        >
                            Войти
                        </button>
                    </form>
                </div>
            </div>
        )
    }

    // Панель настроек
    return (
        <div className="min-h-screen bg-gray-100">
            {/* Header */}
            <header className="bg-white shadow-sm">
                <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Logo className="h-8" />
                        <h1 className="text-xl font-bold text-gray-800">⚙️ Настройки платформы</h1>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="text-gray-500 hover:text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-100"
                    >
                        Выйти
                    </button>
                </div>
            </header>

            {/* Content */}
            <main className="max-w-4xl mx-auto p-4 mt-6">
                {loading ? (
                    <div className="text-center py-10 text-gray-500">
                        Загрузка настроек...
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Instagram Metrics Mode */}
                        <div className="bg-white rounded-xl shadow-sm p-6">
                            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                📸 Instagram метрики
                            </h2>

                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                                <p className="text-sm text-yellow-800">
                                    <strong>⚠️ Instagram API на проверке</strong><br />
                                    Если автоматический сбор метрик не работает, включите ручной режим.
                                    Заказчики будут вводить метрики вручную при проверке публикаций.
                                </p>
                            </div>

                            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                                <div>
                                    <p className="font-medium text-gray-800">Режим сбора метрик</p>
                                    <p className="text-sm text-gray-500 mt-1">
                                        {settings.instagram_metrics_mode?.value === 'manual'
                                            ? '✍️ Ручной ввод заказчиком'
                                            : '🤖 Автоматический (через Instagram API)'
                                        }
                                    </p>
                                    {settings.instagram_metrics_mode?.updated_at && (
                                        <p className="text-xs text-gray-400 mt-2">
                                            Обновлено: {new Date(settings.instagram_metrics_mode.updated_at).toLocaleString('ru-RU')}
                                        </p>
                                    )}
                                </div>
                                <button
                                    onClick={toggleMetricsMode}
                                    className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors ${settings.instagram_metrics_mode?.value === 'manual'
                                            ? 'bg-orange-500'
                                            : 'bg-green-500'
                                        }`}
                                >
                                    <span
                                        className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow ${settings.instagram_metrics_mode?.value === 'manual' ? 'translate-x-8' : 'translate-x-1'
                                            }`}
                                    />
                                </button>
                            </div>

                            {saveStatus && (
                                <div className="mt-4 text-center text-sm font-medium text-gray-600">
                                    {saveStatus}
                                </div>
                            )}

                            <div className="mt-6 grid md:grid-cols-2 gap-4">
                                <div className="p-4 bg-green-50 rounded-lg">
                                    <h4 className="font-medium text-green-800 mb-2">🤖 Автоматический режим</h4>
                                    <ul className="text-sm text-green-700 space-y-1">
                                        <li>• Инфлюенсер подключает Instagram</li>
                                        <li>• Метрики собираются автоматически</li>
                                        <li>• Требуется одобрение Instagram API</li>
                                    </ul>
                                </div>
                                <div className="p-4 bg-orange-50 rounded-lg">
                                    <h4 className="font-medium text-orange-800 mb-2">✍️ Ручной режим</h4>
                                    <ul className="text-sm text-orange-700 space-y-1">
                                        <li>• Подключение Instagram не требуется</li>
                                        <li>• Заказчик вводит метрики вручную</li>
                                        <li>• Работает без Instagram API</li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                        {/* Other Settings Preview */}
                        <div className="bg-white rounded-xl shadow-sm p-6">
                            <h2 className="text-lg font-semibold mb-4">📋 Все настройки</h2>

                            {Object.keys(settings).length === 0 ? (
                                <p className="text-gray-500 text-center py-4">Настройки не найдены</p>
                            ) : (
                                <div className="space-y-3">
                                    {Object.entries(settings).map(([key, data]) => (
                                        <div key={key} className="p-3 bg-gray-50 rounded-lg">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <code className="text-sm font-mono text-blue-600">{key}</code>
                                                    <p className="text-sm text-gray-600 mt-1">
                                                        Значение: <strong>{JSON.stringify(data.value)}</strong>
                                                    </p>
                                                    {data.description && (
                                                        <p className="text-xs text-gray-400 mt-1">{data.description}</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </main>

            {/* Footer */}
            <footer className="text-center py-6 text-sm text-gray-400">
                Telegram Influencer Marketplace • Админ-панель
            </footer>
        </div>
    )
}

export default WebAdminSettings
