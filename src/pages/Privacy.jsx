function Privacy() {
    return (
        <div className="min-h-screen bg-tg-bg pb-20 overflow-x-hidden">
            <div className="max-w-4xl mx-auto p-6">
                {/* Header */}
                <div className="bg-brand-gradient text-white p-6 rounded-2xl mb-6">
                    <div className="flex items-center gap-3 mb-4">
                        <h1 className="text-3xl font-bold">Romashka</h1>
                    </div>
                    <p className="text-lg opacity-90">Политика конфиденциальности</p>
                </div>

                {/* Content */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 space-y-6">
                    <section>
                        <h2 className="text-2xl font-bold mb-4 text-tg-button">1. Общие положения</h2>
                        <div className="space-y-3 text-gray-700 dark:text-gray-300">
                            <p>
                                Настоящая Политика конфиденциальности описывает, как <strong>Romashka</strong> собирает, использует и защищает вашу персональную информацию.
                            </p>
                            <p>
                                Используя наш сервис, вы соглашаетесь с условиями данной политики конфиденциальности.
                            </p>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold mb-4 text-tg-button">2. Какие данные мы собираем</h2>
                        <div className="space-y-3 text-gray-700 dark:text-gray-300">
                            <p>
                                <strong>2.1. Данные от Telegram:</strong>
                            </p>
                            <ul className="list-disc list-inside space-y-2 ml-4">
                                <li>Telegram ID (уникальный идентификатор)</li>
                                <li>Имя и фамилия</li>
                                <li>Username (если указан)</li>
                                <li>Фото профиля (если доступно)</li>
                            </ul>

                            <p className="mt-4">
                                <strong>2.2. Данные от Instagram Business API:</strong>
                            </p>
                            <ul className="list-disc list-inside space-y-2 ml-4">
                                <li>Instagram username</li>
                                <li>Количество подписчиков</li>
                                <li>Статистика публикаций (просмотры, лайки, комментарии)</li>
                                <li>URL профиля Instagram</li>
                                <li>Биография профиля</li>
                            </ul>

                            <p className="mt-4">
                                <strong>2.3. Данные, предоставленные вами:</strong>
                            </p>
                            <ul className="list-disc list-inside space-y-2 ml-4">
                                <li>Платежные реквизиты (номер телефона Kaspi, номер карты)</li>
                                <li>Описания заданий и откликов</li>
                                <li>Ссылки на публикации</li>
                            </ul>

                            <p className="mt-4">
                                <strong>2.4. Автоматически собираемые данные:</strong>
                            </p>
                            <ul className="list-disc list-inside space-y-2 ml-4">
                                <li>История транзакций</li>
                                <li>Дата и время действий в системе</li>
                                <li>Информация о балансе</li>
                            </ul>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold mb-4 text-tg-button">3. Как мы используем данные</h2>
                        <div className="space-y-3 text-gray-700 dark:text-gray-300">
                            <p>
                                Мы используем собранные данные для:
                            </p>
                            <ul className="list-disc list-inside space-y-2 ml-4">
                                <li>Предоставления и улучшения наших услуг</li>
                                <li>Автоматического отслеживания метрик публикаций</li>
                                <li>Обработки платежей и выводов средств</li>
                                <li>Связи между заказчиками и инфлюенсерами</li>
                                <li>Предотвращения мошенничества</li>
                                <li>Технической поддержки</li>
                                <li>Отправки уведомлений о статусе заданий</li>
                            </ul>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold mb-4 text-tg-button">4. Интеграция с Instagram</h2>
                        <div className="space-y-3 text-gray-700 dark:text-gray-300">
                            <p>
                                <strong>4.1.</strong> Мы используем официальный Instagram Graph API для получения публичной статистики ваших публикаций.
                            </p>
                            <p>
                                <strong>4.2.</strong> Авторизация происходит через Facebook/Instagram OAuth 2.0.
                            </p>
                            <p>
                                <strong>4.3.</strong> Мы получаем только те данные, которые вы явно разрешаете при подключении Instagram.
                            </p>
                            <p>
                                <strong>4.4.</strong> Вы можете отключить интеграцию в любое время в настройках профиля.
                            </p>
                            <p>
                                <strong>4.5.</strong> При отключении все токены доступа удаляются из нашей системы.
                            </p>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold mb-4 text-tg-button">5. Передача данных третьим лицам</h2>
                        <div className="space-y-3 text-gray-700 dark:text-gray-300">
                            <p>
                                <strong>5.1.</strong> Мы не продаем и не передаем ваши персональные данные третьим лицам.
                            </p>
                            <p>
                                <strong>5.2.</strong> Исключения составляют:
                            </p>
                            <ul className="list-disc list-inside space-y-2 ml-4">
                                <li>Facebook/Instagram API для получения статистики (с вашего разрешения)</li>
                                <li>Платежные системы для обработки выводов (Kaspi, банки)</li>
                                <li>Telegram API для отправки уведомлений</li>
                                <li>Случаи, предусмотренные законодательством</li>
                            </ul>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold mb-4 text-tg-button">6. Защита данных</h2>
                        <div className="space-y-3 text-gray-700 dark:text-gray-300">
                            <p>
                                <strong>6.1.</strong> Все данные хранятся в защищенной базе данных Supabase с шифрованием.
                            </p>
                            <p>
                                <strong>6.2.</strong> Соединения защищены SSL/TLS сертификатами.
                            </p>
                            <p>
                                <strong>6.3.</strong> Доступ к базе данных имеют только авторизованные администраторы.
                            </p>
                            <p>
                                <strong>6.4.</strong> Токены доступа Instagram хранятся в зашифрованном виде.
                            </p>
                            <p>
                                <strong>6.5.</strong> Платежные реквизиты обрабатываются через защищенные каналы.
                            </p>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold mb-4 text-tg-button">7. Ваши права</h2>
                        <div className="space-y-3 text-gray-700 dark:text-gray-300">
                            <p>
                                Вы имеете право:
                            </p>
                            <ul className="list-disc list-inside space-y-2 ml-4">
                                <li>Просматривать свои данные в профиле</li>
                                <li>Редактировать информацию профиля</li>
                                <li>Отключить интеграцию с Instagram</li>
                                <li>Удалить свой аккаунт (обратитесь к администрации)</li>
                                <li>Запросить копию своих данных</li>
                            </ul>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold mb-4 text-tg-button">8. Удаление данных</h2>
                        <div className="space-y-3 text-gray-700 dark:text-gray-300">
                            <p>
                                <strong>8.1.</strong> При удалении аккаунта все ваши персональные данные удаляются из системы.
                            </p>
                            <p>
                                <strong>8.2.</strong> История транзакций может быть сохранена для бухгалтерских целей согласно законодательству.
                            </p>
                            <p>
                                <strong>8.3.</strong> Для удаления аккаунта обратитесь к администрации через Telegram.
                            </p>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold mb-4 text-tg-button">9. Cookies и аналитика</h2>
                        <div className="space-y-3 text-gray-700 dark:text-gray-300">
                            <p>
                                <strong>9.1.</strong> Мы используем минимальное количество cookies для работы сервиса.
                            </p>
                            <p>
                                <strong>9.2.</strong> Telegram WebApp автоматически управляет сессией пользователя.
                            </p>
                            <p>
                                <strong>9.3.</strong> Мы не используем сторонние аналитические системы слежения.
                            </p>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold mb-4 text-tg-button">10. Изменения политики</h2>
                        <div className="space-y-3 text-gray-700 dark:text-gray-300">
                            <p>
                                Мы можем обновлять данную политику конфиденциальности. О существенных изменениях мы уведомим вас через Telegram.
                            </p>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold mb-4 text-tg-button">11. Контакты</h2>
                        <div className="space-y-3 text-gray-700 dark:text-gray-300">
                            <p>
                                Если у вас есть вопросы по поводу обработки ваших данных, свяжитесь с нами через:
                            </p>
                            <ul className="list-disc list-inside space-y-2 ml-4">
                                <li>Telegram бот</li>
                                <li>Группу поддержки</li>
                                <li>Администрацию платформы</li>
                            </ul>
                        </div>
                    </section>

                    <div className="pt-6 border-t dark:border-gray-700">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Последнее обновление: {new Date().toLocaleDateString('ru-RU', {
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
