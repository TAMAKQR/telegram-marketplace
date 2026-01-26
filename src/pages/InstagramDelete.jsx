function InstagramDelete() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
            <div className="text-center p-8 bg-white dark:bg-gray-800 rounded-2xl shadow-lg max-w-md">
                <h1 className="text-2xl font-bold mb-4">Data Deletion Request</h1>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Your data deletion request has been received.
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-500">
                    All your data will be permanently deleted from our system within 30 days.
                </p>
            </div>
        </div>
    )
}

export default InstagramDelete
