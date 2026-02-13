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
  console.log('[telegram-notify] Sending notification, initData present:', !!window.Telegram?.WebApp?.initData)

  const { data, error } = await supabase.functions.invoke('telegram-notify', {
    body: chatId ? { chatId, message } : { message },
    headers: {
      ...getTelegramInitDataHeader(),
    },
  })

  console.log('[telegram-notify] Response:', { data, error })

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
  let message = ` <b>Новое задание!</b>\n\n`
  message += ` <b>${task.title}</b>\n`
  message += ` Бюджет: <b>${formatTaskBudget(task, { prefix: '' })}</b>\n`

  if (task.requirements?.minFollowers) {
    message += ` Мин. подписчиков: ${task.requirements.minFollowers.toLocaleString()}\n`
  }

  if (task.deadline) {
    const deadlineDate = new Date(task.deadline)
    message += ` Дедлайн: ${deadlineDate.toLocaleDateString('ru-RU')}\n`
  }

  message += `\n <b>Описание:</b>\n${task.description}\n`
  message += `\n Заказчик: ${clientName}`
  message += `\n\n Откликайтесь через бот!`

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
