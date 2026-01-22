import { useState } from 'react'
import { sendTelegramNotification } from '../lib/telegramBot'
import Logo from '../components/Logo'

function TestNotification() {
    const [message, setMessage] = useState('Тестовое сообщение из приложения')
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState(null)

    const testSendMessage = async () => {
        setLoading(true)
        setResult(null)

        try {
            const response = await sendTelegramNotification(message)
            setResult(response)
        } catch (error) {
            setResult({ error: error.message })
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-tg-bg">
            <div className="bg-brand-gradient text-white p-4 pt-8">
                <div className="max-w-md mx-auto flex items-center gap-3">
                    <Logo className="h-7 w-auto" />
                    <h1 className="text-2xl font-bold">Тест уведомлений Telegram</h1>
                </div>
            </div>
            <div className="max-w-md mx-auto p-4">

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-2">Сообщение:</label>
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            className="w-full p-3 border rounded-lg resize-none"
                            rows="3"
                        />
                    </div>

                    <button
                        onClick={testSendMessage}
                        disabled={loading}
                        className="w-full bg-brand hover:opacity-90 text-white font-medium py-3 px-4 rounded-lg disabled:opacity-50"
                    >
                        {loading ? 'Отправка...' : 'Отправить тестовое сообщение'}
                    </button>

                    {result && (
                        <div className="mt-4 p-3 bg-gray-100 rounded-lg">
                            <h3 className="font-medium mb-2">Результат:</h3>
                            <pre className="text-xs overflow-x-auto">
                                {JSON.stringify(result, null, 2)}
                            </pre>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default TestNotification