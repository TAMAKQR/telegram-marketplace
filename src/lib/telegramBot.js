// Telegram Bot API для отправки уведомлений
const BOT_TOKEN = import.meta.env.VITE_TELEGRAM_BOT_TOKEN || '8422178973:AAHHVFvR2MsKsfjdJ2IUJcMqArmyQQ_mxXc'
const CHAT_ID = import.meta.env.VITE_TELEGRAM_GROUP_CHAT_ID || '-1003528858514' // Используем правильный ID как fallback
const ADMIN_ID = 7737197594 // ID администратора

// Отправка сообщения в группу
export const sendTelegramNotification = async (message) => {
    console.log('=== SENDING TELEGRAM NOTIFICATION ===')
    console.log('BOT_TOKEN:', BOT_TOKEN ? 'Loaded' : 'Missing')
    console.log('CHAT_ID:', CHAT_ID)
    console.log('Message:', message)

    try {
        const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: CHAT_ID,
                text: message,
                parse_mode: 'HTML',
                disable_web_page_preview: true
            })
        })

        const result = await response.json()
        console.log('Telegram API response:', result)

        if (!result.ok) {
            console.error('Ошибка отправки в Telegram:', result.description)
        }

        return result
    } catch (error) {
        console.error('Ошибка при отправке уведомления:', error)
    }
}

// Простое получение ID чата
export const getGroupId = async () => {
    try {
        const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates`)
        const result = await response.json()

        if (result.ok && result.result.length > 0) {
            // Ищем последние сообщения из группы
            const groupMessages = result.result.filter(update =>
                update.message && (update.message.chat.type === 'group' || update.message.chat.type === 'supergroup')
            )

            if (groupMessages.length > 0) {
                const lastGroupMessage = groupMessages[groupMessages.length - 1]
                const chatId = lastGroupMessage.message.chat.id
                const chatTitle = lastGroupMessage.message.chat.title

                console.log(`🆔 ID группы: ${chatId}`)
                console.log(`📝 Название: ${chatTitle}`)

                alert(`ID группы: ${chatId}\nНазвание: ${chatTitle}`)
                return { id: chatId, title: chatTitle }
            } else {
                alert('Не найдено сообщений из групп. Отправьте любое сообщение в группу с ботом и попробуйте снова.')
            }
        }
    } catch (error) {
        console.error('Ошибка:', error)
        alert('Ошибка получения ID. Проверьте консоль.')
    }
}

// Форматирование сообщения о новом задании
export const formatNewTaskMessage = (task, clientName) => {
    const categoryEmoji = {
        'Красота и уход': '💄',
        'Мода': '👗',
        'Технологии': '📱',
        'Спорт и фитнес': '💪',
        'Еда и кулинария': '🍳',
        'Путешествия': '✈️',
        'Lifestyle': '🌟',
        'Другое': '📌'
    }

    const emoji = categoryEmoji[task.category] || '📌'

    let message = `${emoji} <b>Новое задание!</b>\n\n`
    message += `📋 <b>${task.title}</b>\n`
    message += `💰 Бюджет: <b>${task.budget.toLocaleString()} сом</b>\n`

    if (task.category) {
        message += `🏷 Категория: ${task.category}\n`
    }

    if (task.requirements?.minFollowers) {
        message += `👥 Мин. подписчиков: ${task.requirements.minFollowers.toLocaleString()}\n`
    }

    if (task.deadline) {
        const deadlineDate = new Date(task.deadline)
        message += `⏰ Дедлайн: ${deadlineDate.toLocaleDateString('ru-RU')}\n`
    }

    message += `\n📝 <b>Описание:</b>\n${task.description}\n`
    message += `\n👤 Заказчик: ${clientName}`
    message += `\n\n🚀 Откликайтесь через бот!`

    return message
}

// Форматирование сообщения о завершении задания
export const formatCompletedTaskMessage = (task, influencerName, amount) => {
    return `✅ <b>Задание завершено!</b>\n\n` +
        `📋 ${task.title}\n` +
        `👤 Исполнитель: ${influencerName}\n` +
        `💰 Выплачено: ${amount.toLocaleString()} сом\n\n` +
        `🎉 Поздравляем с успешным сотрудничеством!`
}

// Проверка является ли пользователь администратором
export const isAdmin = (telegramId) => {
    return telegramId === ADMIN_ID
}

// Отправка админского уведомления
export const sendAdminNotification = async (message) => {
    try {
        const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: ADMIN_ID,
                text: message,
                parse_mode: 'HTML',
                disable_web_page_preview: true
            })
        })

        const result = await response.json()
        return result
    } catch (error) {
        console.error('Ошибка отправки админского уведомления:', error)
    }
}