function Terms() {
    return (
        <div className="min-h-screen bg-tg-bg pb-20 overflow-x-hidden">
            <div className="max-w-4xl mx-auto p-6">
                {/* Header */}
                <div className="bg-brand-gradient text-white p-6 rounded-2xl mb-6">
                    <div className="flex items-center gap-3 mb-4">
                        <h1 className="text-3xl font-bold">Romashka</h1>
                    </div>
                    <p className="text-lg opacity-90">Условия использования</p>
                </div>

                {/* Content */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 space-y-6">
                    <section>
                        <h2 className="text-2xl font-bold mb-4 text-tg-button">1. Общие положения</h2>
                        <div className="space-y-3 text-gray-700 dark:text-gray-300">
                            <p>
                                <strong>Romashka</strong> — это платформа для взаимодействия между заказчиками и инфлюенсерами в социальных сетях.
                            </p>
                            <p>
                                Используя наш сервис, вы принимаете данные условия использования в полном объеме.
                            </p>
                            <p>
                                Если вы не согласны с какими-либо положениями настоящих условий, пожалуйста, не используйте наш сервис.
                            </p>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold mb-4 text-tg-button">2. Описание сервиса</h2>
                        <div className="space-y-3 text-gray-700 dark:text-gray-300">
                            <p>
                                <strong>Romashka</strong> предоставляет следующие возможности:
                            </p>
                            <ul className="list-disc list-inside space-y-2 ml-4">
                                <li>Создание рекламных заданий для инфлюенсеров</li>
                                <li>Подача откликов на задания</li>
                                <li>Автоматическое отслеживание метрик публикаций (просмотры, лайки, комментарии)</li>
                                <li>Интеграция с Instagram Business API для получения статистики</li>
                                <li>Система оплаты и выводов средств</li>
                                <li>Прозрачный процесс одобрения публикаций</li>
                            </ul>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold mb-4 text-tg-button">3. Регистрация и аккаунты</h2>
                        <div className="space-y-3 text-gray-700 dark:text-gray-300">
                            <p>
                                <strong>3.1.</strong> Для использования сервиса необходима регистрация через Telegram.
                            </p>
                            <p>
                                <strong>3.2.</strong> Вы обязуетесь предоставлять достоверную информацию о себе.
                            </p>
                            <p>
                                <strong>3.3.</strong> Вы несете ответственность за сохранность данных своего аккаунта.
                            </p>
                            <p>
                                <strong>3.4.</strong> Запрещается передавать доступ к аккаунту третьим лицам.
                            </p>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold mb-4 text-tg-button">4. Для заказчиков</h2>
                        <div className="space-y-3 text-gray-700 dark:text-gray-300">
                            <p>
                                <strong>4.1.</strong> Заказчик обязуется создавать корректные задания с понятным описанием.
                            </p>
                            <p>
                                <strong>4.2.</strong> Заказчик обязан проверить публикацию в течение разумного срока после размещения.
                            </p>
                            <p>
                                <strong>4.3.</strong> Средства списываются с баланса заказчика автоматически при достижении инфлюенсером целевых метрик.
                            </p>
                            <p>
                                <strong>4.4.</strong> Заказчик имеет право отклонить публикацию с обоснованием причины.
                            </p>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold mb-4 text-tg-button">5. Для инфлюенсеров</h2>
                        <div className="space-y-3 text-gray-700 dark:text-gray-300">
                            <p>
                                <strong>5.1.</strong> Инфлюенсер обязуется размещать качественный контент, соответствующий требованиям задания.
                            </p>
                            <p>
                                <strong>5.2.</strong> Инфлюенсер должен подключить Instagram Business Account для автоматического отслеживания метрик.
                            </p>
                            <p>
                                <strong>5.3.</strong> Оплата производится автоматически при достижении целевых метрик в установленный срок.
                            </p>
                            <p>
                                <strong>5.4.</strong> Инфлюенсер имеет право вывести заработанные средства при достижении минимального порога (100 сом).
                            </p>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold mb-4 text-tg-button">6. Платежи и выводы</h2>
                        <div className="space-y-3 text-gray-700 dark:text-gray-300">
                            <p>
                                <strong>6.1.</strong> Все платежи обрабатываются через защищенные платежные системы.
                            </p>
                            <p>
                                <strong>6.2.</strong> Минимальная сумма вывода составляет 100 сом.
                            </p>
                            <p>
                                <strong>6.3.</strong> Заявки на вывод обрабатываются в течение 1-3 рабочих дней.
                            </p>
                            <p>
                                <strong>6.4.</strong> Сервис не взимает комиссию за внутренние переводы между пользователями.
                            </p>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold mb-4 text-tg-button">7. Интеграция с Instagram</h2>
                        <div className="space-y-3 text-gray-700 dark:text-gray-300">
                            <p>
                                <strong>7.1.</strong> Для работы требуется Instagram Business или Creator аккаунт.
                            </p>
                            <p>
                                <strong>7.2.</strong> Мы используем официальный Instagram Graph API для получения публичной статистики.
                            </p>
                            <p>
                                <strong>7.3.</strong> Вы предоставляете разрешение на доступ к статистике ваших публикаций.
                            </p>
                            <p>
                                <strong>7.4.</strong> Вы можете отключить интеграцию в любое время.
                            </p>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold mb-4 text-tg-button">8. Ответственность</h2>
                        <div className="space-y-3 text-gray-700 dark:text-gray-300">
                            <p>
                                <strong>8.1.</strong> Сервис не несет ответственности за качество контента, размещаемого пользователями.
                            </p>
                            <p>
                                <strong>8.2.</strong> Мы не гарантируем бесперебойную работу сервиса 24/7.
                            </p>
                            <p>
                                <strong>8.3.</strong> Пользователи несут ответственность за соблюдение правил Instagram и законодательства.
                            </p>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold mb-4 text-tg-button">9. Изменение условий</h2>
                        <div className="space-y-3 text-gray-700 dark:text-gray-300">
                            <p>
                                Мы оставляем за собой право изменять данные условия использования. Изменения вступают в силу с момента публикации на сайте.
                            </p>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold mb-4 text-tg-button">10. Контакты</h2>
                        <div className="space-y-3 text-gray-700 dark:text-gray-300">
                            <p>
                                По всем вопросам обращайтесь к администрации через Telegram бот или группу поддержки.
                            </p>
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

export default Terms
