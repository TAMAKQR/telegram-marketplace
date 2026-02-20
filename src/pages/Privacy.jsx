function Privacy() {
    return (
        <div className="min-h-screen bg-tg-bg pb-20 overflow-x-hidden">
            <div className="max-w-4xl mx-auto p-6">
                {/* Header */}
                <div className="bg-brand-gradient text-white p-6 rounded-2xl mb-6">
                    <div className="flex items-center gap-3 mb-4">
                        <h1 className="text-3xl font-bold">Romashka</h1>
                    </div>
                    <p className="text-lg opacity-90">Privacy Policy / Политика конфиденциальности</p>
                </div>

                {/* Content */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 space-y-6">

                    {/* Company info block - required by Meta */}
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-sm text-gray-600 dark:text-gray-400">
                        <p><strong>Оператор данных / Data Controller:</strong></p>
                        <p>ИП Бейшенбеков Адамали Бейшенбекович</p>
                        <p>ИНН: 20407199901093</p>
                        <p>Адрес: Октябрьский р-н, микрорайон 12, дом 48, кв. 15, г. Бишкек, Чуйская обл., 720049, Кыргызская Республика</p>
                        <p>Тел.: +996 700 828 234</p>
                        <p>Email: <a href="mailto:shoppingalanya@gmail.com" className="text-tg-button underline">shoppingalanya@gmail.com</a></p>
                        <p>Веб-сайт: <a href="https://dasmart.xyz" className="text-tg-button underline" target="_blank" rel="noopener noreferrer">https://dasmart.xyz</a></p>
                    </div>

                    <section>
                        <h2 className="text-2xl font-bold mb-4 text-tg-button">1. General Provisions / Общие положения</h2>
                        <div className="space-y-3 text-gray-700 dark:text-gray-300">
                            <p>
                                This Privacy Policy describes how <strong>Romashka</strong> (operated by IE Beishenbek Adamali Beishenbekovich, hereinafter &quot;we&quot;, &quot;us&quot;, &quot;our&quot;) collects, uses, stores, and protects your personal information when you use our platform at <a href="https://dasmart.xyz" className="text-tg-button underline">https://dasmart.xyz</a> and associated Telegram Mini App.
                            </p>
                            <p>
                                Настоящая Политика конфиденциальности описывает, как <strong>Romashka</strong> (оператор — ИП Бейшенбеков Адамали Бейшенбекович) собирает, использует, хранит и защищает вашу персональную информацию.
                            </p>
                            <p>
                                By using our service, you agree to the terms of this Privacy Policy. If you do not agree, please do not use our service.
                            </p>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold mb-4 text-tg-button">2. Legal Basis for Processing / Правовые основания обработки</h2>
                        <div className="space-y-3 text-gray-700 dark:text-gray-300">
                            <p>We process your personal data on the following legal bases:</p>
                            <ul className="list-disc list-inside space-y-2 ml-4">
                                <li><strong>Consent</strong> — when you connect your Instagram account, you explicitly grant permission for us to access your profile and post metrics.</li>
                                <li><strong>Performance of a contract</strong> — processing is necessary to provide our influencer marketing platform services (matching clients with influencers, tracking metrics, processing payments).</li>
                                <li><strong>Legitimate interest</strong> — fraud prevention, service improvement, and technical support.</li>
                                <li><strong>Legal obligation</strong> — financial record-keeping required by law.</li>
                            </ul>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold mb-4 text-tg-button">3. Data We Collect / Какие данные мы собираем</h2>
                        <div className="space-y-3 text-gray-700 dark:text-gray-300">
                            <p>
                                <strong>3.1. Data from Telegram / Данные от Telegram:</strong>
                            </p>
                            <ul className="list-disc list-inside space-y-2 ml-4">
                                <li>Telegram ID (unique identifier)</li>
                                <li>First and last name</li>
                                <li>Username (if set)</li>
                                <li>Profile photo (if available)</li>
                            </ul>

                            <p className="mt-4">
                                <strong>3.2. Data from Meta Platform (Instagram API) / Данные от Instagram Business API:</strong>
                            </p>
                            <ul className="list-disc list-inside space-y-2 ml-4">
                                <li>Instagram user ID and username</li>
                                <li>Follower count</li>
                                <li>Post metrics (views, reach, likes, comments) — via <code>instagram_business_basic</code> and <code>instagram_business_manage_insights</code> permissions</li>
                                <li>Profile URL and biography</li>
                                <li>Media content metadata (post IDs, shortcodes, timestamps, permalinks)</li>
                            </ul>
                            <p className="mt-2 text-sm italic">
                                We access Instagram data only through the official Instagram Graph API and only with your explicit consent via OAuth 2.0 authorization. We do NOT store your Instagram password.
                            </p>

                            <p className="mt-4">
                                <strong>3.3. Data you provide / Данные, предоставленные вами:</strong>
                            </p>
                            <ul className="list-disc list-inside space-y-2 ml-4">
                                <li>Payment details (phone number for Kaspi, bank card number)</li>
                                <li>Task descriptions and submissions</li>
                                <li>Links to publications</li>
                            </ul>

                            <p className="mt-4">
                                <strong>3.4. Automatically collected data / Автоматически собираемые данные:</strong>
                            </p>
                            <ul className="list-disc list-inside space-y-2 ml-4">
                                <li>Transaction history</li>
                                <li>Date and time of actions in the system</li>
                                <li>Balance information</li>
                            </ul>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold mb-4 text-tg-button">4. How We Use Data / Как мы используем данные</h2>
                        <div className="space-y-3 text-gray-700 dark:text-gray-300">
                            <p>
                                We use the collected data for the following purposes:
                            </p>
                            <ul className="list-disc list-inside space-y-2 ml-4">
                                <li>Providing and improving our influencer marketing platform services</li>
                                <li>Automatic tracking of publication metrics (views, likes, comments, engagement rate) through Instagram API</li>
                                <li>Verifying task completion by influencers</li>
                                <li>Processing payments and withdrawal requests</li>
                                <li>Matching clients (advertisers) with influencers based on audience metrics</li>
                                <li>Fraud prevention and platform integrity</li>
                                <li>Technical support and troubleshooting</li>
                                <li>Sending notifications about task statuses via Telegram</li>
                            </ul>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold mb-4 text-tg-button">5. Instagram / Meta Platform Integration</h2>
                        <div className="space-y-3 text-gray-700 dark:text-gray-300">
                            <p>
                                <strong>5.1.</strong> We use the official <strong>Instagram Graph API</strong> (with Instagram Business Login) to access publicly available and authorized post statistics. We comply with the <a href="https://developers.facebook.com/terms/" className="text-tg-button underline" target="_blank" rel="noopener noreferrer">Meta Platform Terms</a> and <a href="https://developers.facebook.com/devpolicy/" className="text-tg-button underline" target="_blank" rel="noopener noreferrer">Meta Developer Policies</a>.
                            </p>
                            <p>
                                <strong>5.2.</strong> Authorization is done via Instagram OAuth 2.0. We request the following permissions:
                            </p>
                            <ul className="list-disc list-inside space-y-2 ml-4">
                                <li><code>instagram_business_basic</code> — to read your profile and media information</li>
                                <li><code>instagram_business_manage_insights</code> — to read engagement metrics of your posts</li>
                            </ul>
                            <p>
                                <strong>5.3.</strong> We access only the data you explicitly authorize. We do NOT post, modify, or delete any content on your Instagram account.
                            </p>
                            <p>
                                <strong>5.4.</strong> You can disconnect your Instagram account at any time from your profile settings. Upon disconnection, all Instagram access tokens are immediately revoked and deleted from our system.
                            </p>
                            <p>
                                <strong>5.5.</strong> Instagram access tokens are stored in an encrypted database (Supabase with RLS policies). Tokens are valid for 60 days and are automatically refreshed.
                            </p>
                            <p>
                                <strong>5.6.</strong> We do NOT sell, share, or transfer Instagram data to any third party. Instagram data is used solely for the purpose of tracking influencer marketing campaign performance within our platform.
                            </p>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold mb-4 text-tg-button">6. Data Sharing / Передача данных третьим лицам</h2>
                        <div className="space-y-3 text-gray-700 dark:text-gray-300">
                            <p>
                                <strong>6.1.</strong> We do NOT sell your personal data to third parties.
                            </p>
                            <p>
                                <strong>6.2.</strong> We may share data only in the following limited cases:
                            </p>
                            <ul className="list-disc list-inside space-y-2 ml-4">
                                <li><strong>Meta/Instagram API</strong> — to retrieve your post metrics (with your explicit consent)</li>
                                <li><strong>Payment processors</strong> — to process withdrawal requests (Kaspi, bank transfers)</li>
                                <li><strong>Telegram API</strong> — to send notifications about task statuses</li>
                                <li><strong>Supabase (data hosting)</strong> — our database provider, with encryption at rest and in transit</li>
                                <li><strong>Law enforcement</strong> — when required by applicable law</li>
                            </ul>
                            <p>
                                <strong>6.3.</strong> Aggregated, anonymised post metrics (e.g., average engagement rate) may be shown to clients (advertisers) to help them select influencers. No personal identifiable information, beyond what the influencer has made publicly available, is disclosed.
                            </p>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold mb-4 text-tg-button">7. Data Retention / Сроки хранения данных</h2>
                        <div className="space-y-3 text-gray-700 dark:text-gray-300">
                            <p>
                                <strong>7.1.</strong> <strong>Instagram tokens</strong> — stored for up to 60 days (token lifecycle), deleted immediately upon disconnection or account deletion.
                            </p>
                            <p>
                                <strong>7.2.</strong> <strong>Instagram metrics data</strong> — stored for the duration of the advertising campaign plus 90 days for dispute resolution, then deleted.
                            </p>
                            <p>
                                <strong>7.3.</strong> <strong>User profile data</strong> — stored until you delete your account or request deletion.
                            </p>
                            <p>
                                <strong>7.4.</strong> <strong>Transaction records</strong> — retained for 3 years as required by financial reporting regulations of the Kyrgyz Republic.
                            </p>
                            <p>
                                <strong>7.5.</strong> <strong>Telegram data</strong> — stored for the duration of your account, deleted upon account deletion.
                            </p>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold mb-4 text-tg-button">8. Data Security / Защита данных</h2>
                        <div className="space-y-3 text-gray-700 dark:text-gray-300">
                            <p>
                                <strong>8.1.</strong> All data is stored in a secure Supabase database with encryption at rest (AES-256).
                            </p>
                            <p>
                                <strong>8.2.</strong> All connections are secured with SSL/TLS certificates (HTTPS).
                            </p>
                            <p>
                                <strong>8.3.</strong> Database access is restricted to authorized administrators using Row Level Security (RLS) policies.
                            </p>
                            <p>
                                <strong>8.4.</strong> Instagram access tokens are stored in encrypted form and never exposed to the frontend client.
                            </p>
                            <p>
                                <strong>8.5.</strong> Payment details are processed through secure channels and are not stored in plain text.
                            </p>
                            <p>
                                <strong>8.6.</strong> API secrets (Instagram App Secret) are stored only in server-side environment variables (Supabase Edge Functions) and never in client-side code.
                            </p>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold mb-4 text-tg-button">9. Your Rights / Ваши права</h2>
                        <div className="space-y-3 text-gray-700 dark:text-gray-300">
                            <p>
                                You have the following rights regarding your personal data:
                            </p>
                            <ul className="list-disc list-inside space-y-2 ml-4">
                                <li><strong>Right of access</strong> — view your data in your profile at any time</li>
                                <li><strong>Right to rectification</strong> — edit your profile information</li>
                                <li><strong>Right to erasure</strong> — request deletion of your account and all associated data by contacting us at <a href="mailto:shoppingalanya@gmail.com" className="text-tg-button underline">shoppingalanya@gmail.com</a></li>
                                <li><strong>Right to withdraw consent</strong> — disconnect Instagram integration at any time from profile settings</li>
                                <li><strong>Right to data portability</strong> — request a copy of your data in a machine-readable format</li>
                                <li><strong>Right to object</strong> — object to processing of your data for specific purposes</li>
                            </ul>
                            <p className="mt-2">
                                To exercise any of these rights, contact us at <a href="mailto:shoppingalanya@gmail.com" className="text-tg-button underline">shoppingalanya@gmail.com</a>. We will respond within 30 days.
                            </p>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold mb-4 text-tg-button">10. Data Deletion / Удаление данных</h2>
                        <div className="space-y-3 text-gray-700 dark:text-gray-300">
                            <p>
                                <strong>10.1.</strong> You can request deletion of your data at any time by:
                            </p>
                            <ul className="list-disc list-inside space-y-2 ml-4">
                                <li>Disconnecting your Instagram account from profile settings (removes Instagram tokens and data)</li>
                                <li>Contacting us at <a href="mailto:shoppingalanya@gmail.com" className="text-tg-button underline">shoppingalanya@gmail.com</a> to request full account deletion</li>
                                <li>Using our <a href="/instagram/delete" className="text-tg-button underline">Data Deletion Request</a> page</li>
                            </ul>
                            <p>
                                <strong>10.2.</strong> Upon receiving a deletion request, we will permanently delete your personal data within 30 days, except for transaction records required by law (retained for up to 3 years).
                            </p>
                            <p>
                                <strong>10.3.</strong> When you deauthorize our app from your Instagram settings, we automatically receive a callback and delete all associated Instagram data and tokens from our system.
                            </p>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold mb-4 text-tg-button">11. Cookies and Analytics / Cookies и аналитика</h2>
                        <div className="space-y-3 text-gray-700 dark:text-gray-300">
                            <p>
                                <strong>11.1.</strong> We use minimal cookies necessary for service operation (session management).
                            </p>
                            <p>
                                <strong>11.2.</strong> Telegram WebApp manages user sessions automatically.
                            </p>
                            <p>
                                <strong>11.3.</strong> We do NOT use third-party tracking or analytics systems.
                            </p>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold mb-4 text-tg-button">12. Children&apos;s Privacy / Конфиденциальность детей</h2>
                        <div className="space-y-3 text-gray-700 dark:text-gray-300">
                            <p>
                                Our service is not directed at individuals under the age of 18. We do not knowingly collect personal data from children. If you become aware that a child has provided us with personal data, please contact us at <a href="mailto:shoppingalanya@gmail.com" className="text-tg-button underline">shoppingalanya@gmail.com</a>.
                            </p>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold mb-4 text-tg-button">13. Changes to This Policy / Изменения политики</h2>
                        <div className="space-y-3 text-gray-700 dark:text-gray-300">
                            <p>
                                We may update this Privacy Policy from time to time. We will notify you of significant changes through Telegram notifications. The updated version is effective from the date of publication on this page.
                            </p>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold mb-4 text-tg-button">14. Contact Us / Контакты</h2>
                        <div className="space-y-3 text-gray-700 dark:text-gray-300">
                            <p>
                                If you have questions about this Privacy Policy or the processing of your data, contact us:
                            </p>
                            <ul className="list-disc list-inside space-y-2 ml-4">
                                <li><strong>Email:</strong> <a href="mailto:shoppingalanya@gmail.com" className="text-tg-button underline">shoppingalanya@gmail.com</a></li>
                                <li><strong>Phone:</strong> +996 700 828 234</li>
                                <li><strong>Address:</strong> Октябрьский р-н, микрорайон 12, дом 48, кв. 15, г. Бишкек, 720049, Кыргызская Республика</li>
                            </ul>
                            <p className="mt-2">
                                For Instagram/Meta-related data inquiries, you may also contact us via the Telegram bot.
                            </p>
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

export default Privacy
