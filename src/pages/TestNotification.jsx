import { useState } from 'react'
import { sendTelegramNotification } from '../lib/telegramBot'

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
        <div className="min-h-screen bg-tg-bg p-4">
            <div className="max-w-md mx-auto">
                <h1 className="text-2xl font-bold mb-4">Тест уведомлений Telegram</h1>

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
                        className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-3 px-4 rounded-lg disabled:opacity-50"
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