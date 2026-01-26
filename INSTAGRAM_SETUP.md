# Настройка Instagram Graph API для автоматической статистики

## Шаг 1: Создание Facebook App

1. Перейдите на https://developers.facebook.com/apps/
2. Нажмите "Create App" (Создать приложение)
3. Выберите тип приложения: **"Business"**
4. Заполните форму:
   - **App Name**: Название вашего приложения (например: "TaskMarket Instagram Integration")
   - **Contact Email**: Ваш email
   - **Business Portfolio**: Можно пропустить или создать новый
5. Нажмите "Create App"

## Шаг 2: Добавление Instagram Graph API

1. В левом меню найдите **"Add Product"**
2. Найдите **"Instagram"** (это Instagram Graph API) и нажмите "Set Up"
3. После добавления перейдите в **Products → Instagram** в левом меню
4. Вы увидите раздел **"Basic Display"**, **"API"** и **"Settings"**

## Шаг 3: Получение App ID и App Secret

1. Перейдите в **Settings → Basic** в левом меню
2. Скопируйте:
   - **App ID** (Instagram App ID)
   - **App Secret** (нажмите "Show" чтобы увидеть)

## Шаг 4: Настройка OAuth Redirect URIs

1. Перейдите в **Settings → Basic** в левом меню Facebook App
2. Прокрутите до раздела **"Add Platform"** и добавьте **"Website"**
3. В **"Site URL"** укажите:
   ```
   https://81ddca9a8115.ngrok-free.app
   ```
4. В поле **"App Domains"** добавьте:
   ```
   81ddca9a8115.ngrok-free.app
   ```
5. Прокрутите вниз и нажмите **"Save Changes"**

6. Затем перейдите в **Products → Instagram → Basic Display**
7. В разделе **"Valid OAuth Redirect URIs"** добавьте:
   ```
   https://81ddca9a8115.ngrok-free.app/instagram/callback
   ```
8. Нажмите **"Save Changes"**

⚠️ **ВАЖНО**: Каждый раз когда меняется ngrok URL, нужно обновлять Redirect URI!

## Шаг 5: Обновление .env файла

Вставьте полученные данные в `.env`:

```env
VITE_INSTAGRAM_APP_ID=ваш_app_id_здесь
VITE_INSTAGRAM_APP_SECRET=ваш_app_secret_здесь
VITE_INSTAGRAM_REDIRECT_URI=https://ваш-ngrok-домен.ngrok-free.app/instagram/callback
```

## Шаг 6: Выполнение SQL миграции

Выполните SQL из файла `migration_instagram_oauth.sql` в Supabase:

1. Откройте https://supabase.com/dashboard/project/xpeyihbnsxcrybnuqsko
2. Перейдите в **SQL Editor**
3. Скопируйте весь SQL из `supabase/migration_instagram_oauth.sql`
4. Вставьте и выполните (Run)

## Шаг 7: Тестирование

1. Перезапустите dev сервер если он запущен
2. Откройте профиль инфлюенсера
3. Нажмите "Подключить Instagram"
4. Авторизуйтесь через Instagram
5. Вы будете перенаправлены обратно в приложение
6. Статус должен показать "Instagram подключен"

## Требования для инфлюенсеров

Каждый инфлюенсер должен:

1. **Иметь бизнес-аккаунт Instagram** (бесплатно)
   - Настройки → Account → Switch to Professional Account
   - Выбрать "Business"

2. **Подключить Instagram к Facebook Page** (обязательно)
   - Настройки → Business → Linked Accounts
   - Подключить Facebook Page

3. **Авторизовать приложение** через кнопку "Подключить Instagram"

## Возможности после подключения

С подключенным Instagram можно:

- ✅ Автоматически получать статистику постов (просмотры, охват, лайки)
- ✅ Отслеживать вовлеченность (engagement rate)
- ✅ Получать данные о подписчиках
- ✅ Проверять выполнение заданий без ручного ввода

## Ограничения

- Токены живут 60 дней, после чего автоматически обновляются
- Можно получить статистику только для бизнес-аккаунтов Instagram
- Для статистики постов пост должен быть опубликован через бизнес-аккаунт

## Troubleshooting

### Ошибка "Invalid OAuth Redirect URI"
- Проверьте что REDIRECT_URI в .env точно совпадает с настройками в Facebook App
- Убедитесь что используете https (ngrok предоставляет https автоматически)

### Ошибка "Invalid Client Secret"
- Проверьте что APP_SECRET скопирован правильно
- Убедитесь что нет лишних пробелов в .env

### Токен истек
- Приложение автоматически обновит токен через 60 дней
- Если токен истек раньше, инфлюенсер может переподключить Instagram

## Production

Для production:
1. Переведите Facebook App из "Development" в "Live" режим
2. Обновите REDIRECT_URI на финальный домен
3. Настройте автоматическое обновление токенов (cron job каждые 50 дней)
