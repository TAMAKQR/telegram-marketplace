function Terms() {
    return (
        <div className="min-h-screen bg-tg-bg pb-20 overflow-x-hidden">
            <div className="max-w-4xl mx-auto p-6">
                {/* Header */}
                <div className="bg-brand-gradient text-white p-6 rounded-2xl mb-6">
                    <div className="flex items-center gap-3 mb-4">
                        <h1 className="text-3xl font-bold">Romashka</h1>
                    </div>
                    <p className="text-lg opacity-90">Terms of Service / Условия использования</p>
                </div>

                {/* Content */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 space-y-6">

                    {/* Company info block - required by Meta */}
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-sm text-gray-600 dark:text-gray-400">
                        <p><strong>Service Operator / Оператор сервиса:</strong></p>
                        <p>ИП Бейшенбеков Адамали Бейшенбекович</p>
                        <p>ИНН: 20407199901093</p>
                        <p>Адрес: Октябрьский р-н, микрорайон 12, дом 48, кв. 15, г. Бишкек, Чуйская обл., 720049, Кыргызская Республика</p>
                        <p>Email: <a href="mailto:shoppingalanya@gmail.com" className="text-tg-button underline">shoppingalanya@gmail.com</a></p>
                        <p>Веб-сайт: <a href="https://dasmart.xyz" className="text-tg-button underline" target="_blank" rel="noopener noreferrer">https://dasmart.xyz</a></p>
                    </div>

                    <section>
                        <h2 className="text-2xl font-bold mb-4 text-tg-button">1. General Provisions / Общие положения</h2>
                        <div className="space-y-3 text-gray-700 dark:text-gray-300">
                            <p>
                                <strong>Romashka</strong> is an influencer marketing platform operated by IE Beishenbek Adamali Beishenbekovich (hereinafter &quot;we&quot;, &quot;us&quot;, &quot;our&quot;, &quot;the Platform&quot;) that connects advertisers (clients) with social media influencers.
                            </p>
                            <p>
                                By using our service, you accept these Terms of Service in full. If you disagree with any provision, please do not use our service.
                            </p>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold mb-4 text-tg-button">2. Service Description / Описание сервиса</h2>
                        <div className="space-y-3 text-gray-700 dark:text-gray-300">
                            <p>
                                <strong>Romashka</strong> provides the following services:
                            </p>
                            <ul className="list-disc list-inside space-y-2 ml-4">
                                <li>Creating advertising tasks for influencers</li>
                                <li>Accepting and managing task submissions</li>
                                <li>Automatic tracking of publication metrics (views, likes, comments, engagement rate) through Instagram Graph API</li>
                                <li>Integration with Instagram Business API for verified performance data</li>
                                <li>Payment processing and fund withdrawal system</li>
                                <li>Transparent publication approval workflow</li>
                            </ul>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold mb-4 text-tg-button">3. Registration and Accounts / Регистрация и аккаунты</h2>
                        <div className="space-y-3 text-gray-700 dark:text-gray-300">
                            <p>
                                <strong>3.1.</strong> Registration is done through Telegram. You must be at least 18 years old to use this service.
                            </p>
                            <p>
                                <strong>3.2.</strong> You agree to provide accurate and truthful information about yourself.
                            </p>
                            <p>
                                <strong>3.3.</strong> You are responsible for maintaining the security of your account.
                            </p>
                            <p>
                                <strong>3.4.</strong> Sharing your account access with third parties is prohibited.
                            </p>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold mb-4 text-tg-button">4. For Clients (Advertisers) / Для заказчиков</h2>
                        <div className="space-y-3 text-gray-700 dark:text-gray-300">
                            <p>
                                <strong>4.1.</strong> Clients must create accurate tasks with clear descriptions and requirements.
                            </p>
                            <p>
                                <strong>4.2.</strong> Clients must review submissions within a reasonable time after publication.
                            </p>
                            <p>
                                <strong>4.3.</strong> Funds are automatically deducted from the client&apos;s balance when an influencer meets target metrics.
                            </p>
                            <p>
                                <strong>4.4.</strong> Clients may reject a publication with a justified reason.
                            </p>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold mb-4 text-tg-button">5. For Influencers / Для инфлюенсеров</h2>
                        <div className="space-y-3 text-gray-700 dark:text-gray-300">
                            <p>
                                <strong>5.1.</strong> Influencers must publish quality content that meets task requirements.
                            </p>
                            <p>
                                <strong>5.2.</strong> Influencers must connect an Instagram Business or Creator Account for automatic metrics tracking.
                            </p>
                            <p>
                                <strong>5.3.</strong> Payment is processed automatically when target metrics are reached within the specified timeframe.
                            </p>
                            <p>
                                <strong>5.4.</strong> Influencers may withdraw earned funds when the minimum threshold is reached (100 KGS).
                            </p>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold mb-4 text-tg-button">6. Payments and Withdrawals / Платежи и выводы</h2>
                        <div className="space-y-3 text-gray-700 dark:text-gray-300">
                            <p>
                                <strong>6.1.</strong> All payments are processed through secure payment systems.
                            </p>
                            <p>
                                <strong>6.2.</strong> Minimum withdrawal amount is 100 KGS.
                            </p>
                            <p>
                                <strong>6.3.</strong> Withdrawal requests are processed within 1-3 business days.
                            </p>
                            <p>
                                <strong>6.4.</strong> The service does not charge commission for internal transfers between users.
                            </p>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold mb-4 text-tg-button">7. Instagram Integration / Интеграция с Instagram</h2>
                        <div className="space-y-3 text-gray-700 dark:text-gray-300">
                            <p>
                                <strong>7.1.</strong> A professional Instagram account (Business or Creator) is required for influencer functionality.
                            </p>
                            <p>
                                <strong>7.2.</strong> We use the official Instagram Graph API through Instagram Business Login to retrieve post statistics. Our use of Instagram data complies with the <a href="https://developers.facebook.com/terms/" className="text-tg-button underline" target="_blank" rel="noopener noreferrer">Meta Platform Terms</a>.
                            </p>
                            <p>
                                <strong>7.3.</strong> By connecting your Instagram account, you grant permission for us to access your profile information and publication metrics (<code>instagram_business_basic</code>, <code>instagram_business_manage_insights</code>).
                            </p>
                            <p>
                                <strong>7.4.</strong> You may disconnect your Instagram account at any time from your profile settings. All tokens and associated data will be deleted immediately.
                            </p>
                            <p>
                                <strong>7.5.</strong> We are NOT affiliated with, endorsed by, or officially connected to Meta Platforms, Inc. or Instagram. Instagram is a registered trademark of Meta Platforms, Inc.
                            </p>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold mb-4 text-tg-button">8. Prohibited Activities / Запрещённые действия</h2>
                        <div className="space-y-3 text-gray-700 dark:text-gray-300">
                            <p>Users are prohibited from:</p>
                            <ul className="list-disc list-inside space-y-2 ml-4">
                                <li>Using bots, fake accounts, or artificial means to inflate metrics</li>
                                <li>Purchasing fake followers, likes, or comments</li>
                                <li>Submitting fraudulent or plagiarized content</li>
                                <li>Violating Instagram&apos;s Terms of Service or Community Guidelines</li>
                                <li>Attempting to manipulate or bypass the platform&apos;s tracking system</li>
                                <li>Harassing or threatening other users</li>
                            </ul>
                            <p className="mt-2">Violation of these rules may result in account suspension or permanent ban.</p>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold mb-4 text-tg-button">9. Liability / Ответственность</h2>
                        <div className="space-y-3 text-gray-700 dark:text-gray-300">
                            <p>
                                <strong>9.1.</strong> The Platform is not responsible for the quality of content published by users.
                            </p>
                            <p>
                                <strong>9.2.</strong> We do not guarantee uninterrupted 24/7 service availability.
                            </p>
                            <p>
                                <strong>9.3.</strong> Users are responsible for complying with Instagram&apos;s rules, Meta Platform Terms, and applicable legislation.
                            </p>
                            <p>
                                <strong>9.4.</strong> We are not liable for any changes to the Instagram API or Meta Platform that may affect service functionality.
                            </p>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold mb-4 text-tg-button">10. Governing Law / Применимое право</h2>
                        <div className="space-y-3 text-gray-700 dark:text-gray-300">
                            <p>
                                These Terms of Service are governed by and construed in accordance with the laws of the Kyrgyz Republic. Any disputes shall be resolved in the courts of the Kyrgyz Republic, Bishkek city.
                            </p>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold mb-4 text-tg-button">11. Changes to Terms / Изменение условий</h2>
                        <div className="space-y-3 text-gray-700 dark:text-gray-300">
                            <p>
                                We reserve the right to modify these Terms of Service. Changes take effect from the moment of publication on the website. We will notify users of significant changes via Telegram.
                            </p>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold mb-4 text-tg-button">12. Contact Us / Контакты</h2>
                        <div className="space-y-3 text-gray-700 dark:text-gray-300">
                            <p>
                                For questions regarding these Terms, contact us:
                            </p>
                            <ul className="list-disc list-inside space-y-2 ml-4">
                                <li><strong>Email:</strong> <a href="mailto:shoppingalanya@gmail.com" className="text-tg-button underline">shoppingalanya@gmail.com</a></li>
                                <li><strong>Phone:</strong> +996 700 828 234</li>
                                <li><strong>Telegram bot</strong> — for quick support</li>
                            </ul>
                        </div>
                    </section>

                    <div className="pt-6 border-t dark:border-gray-700">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Effective date: February 20, 2026 | Last updated: {new Date().toLocaleDateString('ru-RU', {
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric'
                            })}
                        </p>
                    </div>
                </div>

            </div>
        </div>
    )
}

export default Terms
