import { supabase } from './supabase'
import { formatTaskBudget } from './taskBudget'

const ADMIN_ID = 7737197594 // Telegram user id

const getTelegramInitDataHeader = () => {
  const initData = window.Telegram?.WebApp?.initData
  return initData ? { 'x-telegram-init-data': initData } : {}
}

export const sendTelegramNotification = async (message) => {
  return sendTelegramNotificationWithOptions(message, {})
}

const sendTelegramNotificationWithOptions = async (message, options = {}) => {
  const { silent = false, chatId } = options

  const { data, error } = await supabase.functions.invoke('telegram-notify', {
    body: chatId ? { chatId, message } : { message },
    headers: {
      ...getTelegramInitDataHeader(),
    },
  })

  if (error) {
    const log = silent ? console.debug : console.warn
    log('telegram-notify invoke failed:', error)
    return null
  }

  // Telegram API returns { ok: false, description, ... } on errors.
  if (data && data.ok === false) {
    const log = silent ? console.debug : console.warn
    log('telegram-notify telegram API error:', data)
    return null
  }

  return data
}

export const formatNewTaskMessage = (task, clientName) => {
  let message = `🎯 <b>НОВОЕ ЗАДАНИЕ</b>\n`
  message += `━━━━━━━━━━━━━━━━━━━━\n\n`

  message += `📌 <b>${task.title}</b>\n\n`

  message += `💰 Бюджет: <b>${formatTaskBudget(task, { prefix: '' })}</b>\n`

  if (task.requirements?.minFollowers) {
    message += `👥 Мин. подписчиков: <b>${task.requirements.minFollowers.toLocaleString()}</b>\n`
  }

  if (task.requirements?.minEngagement) {
    message += `📈 Мин. ER: <b>${task.requirements.minEngagement}%</b>\n`
  }

  if (task.deadline) {
    const deadlineDate = new Date(task.deadline)
    message += `📅 Дедлайн: <b>${deadlineDate.toLocaleDateString('ru-RU')}</b>\n`
  }

  message += `\n📝 <b>Описание:</b>\n<i>${task.description.slice(0, 300)}${task.description.length > 300 ? '...' : ''}</i>\n`

  message += `\n━━━━━━━━━━━━━━━━━━━━\n`
  message += `👤 Заказчик: ${clientName}\n\n`
  message += `👉 <a href="https://t.me/romashkacz_bot/ugc">Откликнуться на задание</a>`

  return message
}

export const formatCompletedTaskMessage = (task, influencerName, amount) => {
  return (
    ` <b>Задание завершено!</b>\n\n` +
    ` ${task.title}\n` +
    ` Исполнитель: ${influencerName}\n` +
    ` Выплачено: ${amount.toLocaleString()} сом\n\n` +
    ` Поздравляем с успешным сотрудничеством!`
  )
}

export const isAdmin = (telegramId) => {
  return telegramId === ADMIN_ID
}

export const sendAdminNotification = async (message) => {
  return sendTelegramNotificationWithOptions(message, { chatId: ADMIN_ID })
}

export const sendTelegramNotificationSilent = async (message) => {
  return sendTelegramNotificationWithOptions(message, { silent: true })
}
