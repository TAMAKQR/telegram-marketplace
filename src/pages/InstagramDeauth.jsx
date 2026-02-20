function InstagramDeauth() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
            <div className="text-center p-8 bg-white dark:bg-gray-800 rounded-2xl shadow-lg max-w-md">
                <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878l4.242 4.242M15.121 15.121L21 21" />
                    </svg>
                </div>
                <h1 className="text-2xl font-bold mb-4">Instagram Disconnected</h1>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Your Instagram connection has been removed successfully.
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-500 mb-4">
                    All Instagram access tokens and associated data have been deleted from our system.
                </p>
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        You can reconnect your Instagram account at any time from the app&apos;s profile settings.
                    </p>
                </div>
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

export default InstagramDeauth
