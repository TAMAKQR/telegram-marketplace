export default function InfluencerGuide() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
            {/* Hero Section */}
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white py-20">
                <div className="max-w-6xl mx-auto px-6">
                    <h1 className="text-5xl font-bold mb-4">📱 Инструкция для Инфлюенсеров</h1>
                    <p className="text-2xl opacity-90">Маркетплейс Romashka</p>
                    <p className="mt-4 text-xl">Начните зарабатывать на своем контенте прямо сейчас! 🚀</p>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-6 py-12">
                {/* Как начать работать */}
                <section className="mb-16">
                    <h2 className="text-4xl font-bold text-gray-800 mb-8">🎯 Как начать работать</h2>

                    <div className="grid md:grid-cols-2 gap-8">
                        <div className="bg-white rounded-2xl shadow-lg p-8">
                            <h3 className="text-2xl font-bold text-purple-600 mb-4">1️⃣ Регистрация</h3>
                            <ol className="space-y-3 text-gray-700">
                                <li>✓ Откройте бота в Telegram</li>
                                <li>✓ Нажмите "Старт"</li>
                                <li>✓ Выберите "Я инфлюенсер"</li>
                            </ol>
                        </div>

                        <div className="bg-white rounded-2xl shadow-lg p-8">
                            <h3 className="text-2xl font-bold text-purple-600 mb-4">2️⃣ Подключение Instagram</h3>
                            <ol className="space-y-3 text-gray-700">
                                <li>✓ Перейдите в "Профиль"</li>
                                <li>✓ Нажмите "Подключить Instagram"</li>
                                <li>✓ Авторизуйтесь через Facebook</li>
                                <li>✓ Выберите Instagram Business аккаунт</li>
                            </ol>
                        </div>
                    </div>

                    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-6 mt-8 rounded-lg">
                        <p className="font-bold text-yellow-800 mb-2">⚠️ ВАЖНО - Требования к аккаунту:</p>
                        <ul className="text-yellow-700 space-y-2">
                            <li>• Instagram Business или Creator аккаунт</li>
                            <li>• Подключен к Facebook Странице (Page)</li>
                            <li>• НЕ личный профиль Facebook!</li>
                            <li>• НЕ обычный Instagram аккаунт!</li>
                        </ul>
                    </div>
                </section>

                {/* Как создать Business аккаунт */}
                <section className="mb-16 bg-white rounded-2xl shadow-lg p-8">
                    <h2 className="text-3xl font-bold text-gray-800 mb-6">📱 Как создать Business аккаунт Instagram</h2>
                    <div className="space-y-4 text-gray-700">
                        <div className="flex items-start gap-3">
                            <span className="bg-purple-600 text-white rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 font-bold">1</span>
                            <p>Откройте Instagram → Настройки → Тип аккаунта</p>
                        </div>
                        <div className="flex items-start gap-3">
                            <span className="bg-purple-600 text-white rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 font-bold">2</span>
                            <p>Выберите "Переключиться на профессиональный аккаунт"</p>
                        </div>
                        <div className="flex items-start gap-3">
                            <span className="bg-purple-600 text-white rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 font-bold">3</span>
                            <p>Выберите "Бизнес" или "Автор"</p>
                        </div>
                        <div className="flex items-start gap-3">
                            <span className="bg-purple-600 text-white rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 font-bold">4</span>
                            <div>
                                <p className="font-semibold mb-2">Создайте Facebook Страницу (если нет):</p>
                                <ul className="ml-6 space-y-1">
                                    <li>• Откройте Facebook</li>
                                    <li>• Меню → Страницы → Создать страницу</li>
                                    <li>• Заполните информацию о вашем бренде</li>
                                </ul>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <span className="bg-purple-600 text-white rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 font-bold">5</span>
                            <div>
                                <p className="font-semibold mb-2">Свяжите Instagram с Facebook Страницей:</p>
                                <ul className="ml-6 space-y-1">
                                    <li>• Instagram → Настройки → Бизнес</li>
                                    <li>• Подключить к Facebook Странице</li>
                                    <li>• Выберите созданную страницу</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                    <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                        <p className="text-blue-800">💡 После создания Business аккаунта подождите 10-15 минут и попробуйте подключиться снова!</p>
                    </div>
                </section>

                {/* Частые ошибки */}
                <section className="mb-16">
                    <h2 className="text-3xl font-bold text-gray-800 mb-6">❌ Частые ошибки</h2>
                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="bg-red-50 border-l-4 border-red-400 p-6 rounded-lg">
                            <p className="font-bold text-red-800 mb-3">"Не найден Instagram Business аккаунт"</p>
                            <ul className="text-red-700 space-y-2">
                                <li>• У вас личный аккаунт Instagram</li>
                                <li>• Instagram не подключен к Facebook Странице</li>
                                <li>• Подключена к личному профилю FB вместо Страницы</li>
                            </ul>
                        </div>
                        <div className="bg-red-50 border-l-4 border-red-400 p-6 rounded-lg">
                            <p className="font-bold text-red-800 mb-3">"Ошибка авторизации"</p>
                            <ul className="text-red-700 space-y-2">
                                <li>• Недостаточно прав на Facebook Странице</li>
                                <li>• Страница заблокирована или ограничена</li>
                                <li>• Нужно быть администратором Страницы</li>
                            </ul>
                        </div>
                    </div>
                </section>

                {/* Как получать заказы */}
                <section className="mb-16 bg-gradient-to-r from-purple-100 to-pink-100 rounded-2xl p-8">
                    <h2 className="text-3xl font-bold text-gray-800 mb-6">💼 Как получать заказы</h2>
                    <div className="grid md:grid-cols-3 gap-6">
                        <div className="bg-white rounded-xl p-6">
                            <h3 className="font-bold text-lg mb-3 text-purple-600">Поиск заданий</h3>
                            <p className="text-gray-700">Выберите "Доступные задания" в меню и просмотрите активные заказы</p>
                        </div>
                        <div className="bg-white rounded-xl p-6">
                            <h3 className="font-bold text-lg mb-3 text-purple-600">Информация</h3>
                            <p className="text-gray-700">Изучите бюджет, требования и целевые метрики задания</p>
                        </div>
                        <div className="bg-white rounded-xl p-6">
                            <h3 className="font-bold text-lg mb-3 text-purple-600">Отклик</h3>
                            <p className="text-gray-700">Нажмите "Откликнуться" и дождитесь одобрения заказчика</p>
                        </div>
                    </div>
                </section>

                {/* Выполнение задания */}
                <section className="mb-16">
                    <h2 className="text-3xl font-bold text-gray-800 mb-6">✅ Выполнение задания</h2>
                    <div className="bg-white rounded-2xl shadow-lg p-8">
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-xl font-bold text-purple-600 mb-3">После одобрения:</h3>
                                <ol className="space-y-3 text-gray-700">
                                    <li>1. Опубликуйте контент согласно требованиям</li>
                                    <li>2. Загрузите скриншот публикации через бота</li>
                                    <li>3. Дождитесь проверки заказчиком</li>
                                </ol>
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-purple-600 mb-3">Ожидание метрик:</h3>
                                <p className="text-gray-700 mb-2">После одобрения публикации у вас будет определенный срок для достижения целевых метрик:</p>
                                <ul className="space-y-2 text-gray-700">
                                    <li>• Просмотры</li>
                                    <li>• Лайки</li>
                                    <li>• Комментарии</li>
                                </ul>
                                <p className="text-sm text-gray-600 mt-2">Срок указывается в описании задания!</p>
                            </div>
                            <div className="bg-green-50 border-l-4 border-green-400 p-4 rounded-lg">
                                <p className="font-bold text-green-800">💰 Автоматическая оплата:</p>
                                <p className="text-green-700">Как только метрики будут достигнуты, оплата автоматически поступит на ваш баланс!</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Ценовые диапазоны */}
                <section className="mb-16 bg-gradient-to-br from-yellow-100 to-orange-100 rounded-2xl p-8">
                    <h2 className="text-3xl font-bold text-gray-800 mb-6">📊 Ценовые диапазоны</h2>
                    <p className="text-gray-700 mb-4">Некоторые задания используют гибкое ценообразование:</p>
                    <div className="bg-white rounded-xl p-6 mb-4">
                        <p className="font-bold text-lg mb-3 text-orange-600">Пример:</p>
                        <div className="space-y-2 text-gray-700">
                            <div className="flex justify-between items-center border-b pb-2">
                                <span>1,000-5,000 просмотров</span>
                                <span className="font-bold text-green-600">500 сом</span>
                            </div>
                            <div className="flex justify-between items-center border-b pb-2">
                                <span>5,001-10,000 просмотров</span>
                                <span className="font-bold text-green-600">1,000 сом</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span>10,001-20,000 просмотров</span>
                                <span className="font-bold text-green-600">2,000 сом</span>
                            </div>
                        </div>
                    </div>
                    <p className="text-xl font-bold text-center text-orange-600">Чем больше метрик наберете - тем больше заработаете! 💪</p>
                </section>

                {/* Правила */}
                <section className="mb-16">
                    <h2 className="text-3xl font-bold text-gray-800 mb-6">⚠️ Важные правила</h2>
                    <div className="grid md:grid-cols-3 gap-6">
                        <div className="bg-green-50 rounded-xl p-6">
                            <h3 className="font-bold text-lg mb-4 text-green-700">✅ Можно:</h3>
                            <ul className="space-y-2 text-gray-700">
                                <li>• Брать несколько заданий одновременно</li>
                                <li>• Отменить отклик до одобрения</li>
                                <li>• Связываться с заказчиком</li>
                            </ul>
                        </div>
                        <div className="bg-red-50 rounded-xl p-6">
                            <h3 className="font-bold text-lg mb-4 text-red-700">❌ Нельзя:</h3>
                            <ul className="space-y-2 text-gray-700">
                                <li>• Использовать накрутку</li>
                                <li>• Удалять пост до завершения</li>
                                <li>• Нарушать авторские права</li>
                            </ul>
                        </div>
                        <div className="bg-orange-50 rounded-xl p-6">
                            <h3 className="font-bold text-lg mb-4 text-orange-700">🚫 Штрафы:</h3>
                            <ul className="space-y-2 text-gray-700">
                                <li>• Фейковые метрики - блокировка</li>
                                <li>• Удаление поста - возврат средств</li>
                                <li>• Нарушение дедлайна - отмена</li>
                            </ul>
                        </div>
                    </div>
                </section>

                {/* Советы */}
                <section className="mb-16 bg-white rounded-2xl shadow-lg p-8">
                    <h2 className="text-3xl font-bold text-gray-800 mb-6">📈 Советы для успеха</h2>
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="flex items-start gap-3">
                            <span className="text-2xl">✓</span>
                            <p className="text-gray-700">Подключите Instagram Business - это обязательно</p>
                        </div>
                        <div className="flex items-start gap-3">
                            <span className="text-2xl">✓</span>
                            <p className="text-gray-700">Откликайтесь быстро - задания разбирают быстро</p>
                        </div>
                        <div className="flex items-start gap-3">
                            <span className="text-2xl">✓</span>
                            <p className="text-gray-700">Качественный контент = новые заказы</p>
                        </div>
                        <div className="flex items-start gap-3">
                            <span className="text-2xl">✓</span>
                            <p className="text-gray-700">Соблюдайте дедлайны - это влияет на репутацию</p>
                        </div>
                    </div>
                </section>

                {/* CTA */}
                <section className="bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-2xl p-12 text-center">
                    <h2 className="text-4xl font-bold mb-4">🎉 Начните зарабатывать прямо сейчас!</h2>
                    <p className="text-xl mb-8">Откройте бота, подключите Instagram и найдите первое задание!</p>
                    <div className="flex flex-wrap justify-center gap-4">
                        <a href="https://t.me/romashka_marketplace_bot" className="bg-white text-purple-600 px-8 py-4 rounded-full font-bold text-lg hover:shadow-lg transition-shadow">
                            🤖 Открыть бота
                        </a>
                        <a href="https://t.me/romashka_marketplace" className="bg-white bg-opacity-20 text-white px-8 py-4 rounded-full font-bold text-lg hover:bg-opacity-30 transition-colors">
                            💬 Наш канал
                        </a>
                    </div>
                    <p className="mt-8 text-2xl">Удачи и больших заработков! 🚀</p>
                </section>
            </div>

            {/* Footer */}
            <div className="bg-gray-900 text-white py-8">
                <div className="max-w-6xl mx-auto px-6 text-center">
                    <p className="text-gray-400">© 2026 Romashka. Все права защищены.</p>
                    <div className="mt-4 flex justify-center gap-6">
                        <a href="/privacy" className="text-gray-400 hover:text-white">Политика конфиденциальности</a>
                        <a href="/terms" className="text-gray-400 hover:text-white">Условия использования</a>
                    </div>
                </div>
            </div>
        </div>
    )
}
