import { useEffect, useState } from 'react'

function InstagramDelete() {
    const [confirmationCode, setConfirmationCode] = useState(null)

    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        const code = params.get('code')
        if (code) setConfirmationCode(code)
    }, [])

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
            <div className="text-center p-8 bg-white dark:bg-gray-800 rounded-2xl shadow-lg max-w-md">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                </div>
                <h1 className="text-2xl font-bold mb-4">Data Deletion Request</h1>

                {confirmationCode ? (
                    <div className="space-y-4">
                        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                            <p className="text-green-700 dark:text-green-400 font-medium mb-2">
                                Your data deletion request has been received and is being processed.
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Confirmation code:
                            </p>
                            <p className="font-mono text-lg font-bold text-gray-800 dark:text-gray-200 mt-1">
                                {confirmationCode}
                            </p>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-500">
                            All your Instagram data (access tokens, username, user ID) will be permanently deleted from our system within 30 days.
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-500">
                            Transaction records may be retained for up to 3 years as required by financial regulations.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <p className="text-gray-600 dark:text-gray-400">
                            Your data deletion request has been received.
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-500">
                            All your Instagram data will be permanently deleted from our system within 30 days.
                        </p>
                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 text-left">
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                <strong>To request data deletion manually:</strong>
                            </p>
                            <ul className="text-sm text-gray-500 dark:text-gray-500 list-disc list-inside space-y-1">
                                <li>Disconnect Instagram from your profile in the app</li>
                                <li>Or email us at <a href="mailto:shoppingalanya@gmail.com" className="text-blue-500 underline">shoppingalanya@gmail.com</a></li>
                            </ul>
                        </div>
                    </div>
                )}

                <div className="mt-6 pt-4 border-t dark:border-gray-700">
                    <p className="text-xs text-gray-400">
                        Romashka — IE Beishenbek Adamali Beishenbekovich
                        <br />
                        Contact: <a href="mailto:shoppingalanya@gmail.com" className="underline">shoppingalanya@gmail.com</a>
                    </p>
                </div>
            </div>
        </div>
    )
}

export default InstagramDelete
