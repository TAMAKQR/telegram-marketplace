# Настройка Instagram API с авторизацией через Instagram (Business Login)

## Шаг 1: Создание Meta App

1. Перейдите на https://developers.facebook.com/apps/
2. Нажмите "Create App" (Создать приложение)
3. Выберите тип приложения: **"Business"**
4. Заполните форму:
   - **App Name**: Название вашего приложения (например: "TaskMarket Instagram Integration")
   - **Contact Email**: Ваш email
   - **Business Portfolio**: Можно пропустить или создать новый
5. Нажмите "Create App"

## Шаг 2: Добавление Instagram API с Instagram Login

1. В левом меню найдите **"Add Product"**
2. Найдите **"Instagram"** и нажмите "Set Up"
3. Выберите **"Instagram API with Instagram Login"** (НЕ "with Facebook Login")
4. Перейдите в **Instagram > API setup with Instagram business login**

## Шаг 3: Получение Instagram App ID и App Secret

1. В **Instagram > API setup with Instagram business login** найдите:
   - **Instagram App ID** (отличается от Facebook App ID!)
   - **Instagram App Secret** (нажмите "Show" чтобы увидеть)

⚠️ **ВАЖНО**: Используйте именно Instagram App ID/Secret, а НЕ Facebook App ID/Secret!

## Шаг 4: Настройка Business Login

1. В **Instagram > API setup with Instagram business login > Set up Instagram business login**
2. Нажмите **"Business login settings"**
3. В **"Valid OAuth Redirect URIs"** добавьте:
   ```
   https://ваш-домен.com/instagram/callback
   ```
4. Выберите нужные **Permissions** (скоупы):
   - `instagram_business_basic` — обязательно
   - `instagram_business_manage_insights` — для статистики постов
5. Скопируйте **Embed URL** — это готовая ссылка для OAuth
6. Нажмите **"Save"**

⚠️ **ВАЖНО**: Каждый раз когда меняется домен/ngrok URL, нужно обновлять Redirect URI!

## Шаг 5: Переменные окружения (важно про секреты)

### Frontend (Vite)

В `.env.local` задаём только client-safe переменные:

```env
VITE_INSTAGRAM_APP_ID=ваш_instagram_app_id_здесь
VITE_INSTAGRAM_REDIRECT_URI=https://ваш-домен.com/instagram/callback
```

⚠️ **ВАЖНО**: `VITE_INSTAGRAM_APP_ID` — это Instagram App ID из шага 3, НЕ Facebook App ID!

### Supabase Edge Functions secrets (server-side)

`App Secret` нельзя хранить в `VITE_*` (он попадёт в браузер). Секреты задаются через Supabase:

```powershell
# Локально
npx supabase@latest secrets set INSTAGRAM_APP_ID="<instagram_app_id>" INSTAGRAM_APP_SECRET="<instagram_app_secret>" INSTAGRAM_REDIRECT_URI="<redirect_uri>"

# Или через Dashboard для production
```

## Шаг 6: Выполнение SQL миграции

Выполните SQL из файла `supabase/migrations/migration_instagram_oauth.sql` в Supabase:

1. Откройте https://supabase.com/dashboard/project/xpeyihbnsxcrybnuqsko
2. Перейдите в **SQL Editor**
3. Скопируйте весь SQL из `supabase/migrations/migration_instagram_oauth.sql`
4. Вставьте и выполните (Run)

## Шаг 7: Тестирование

1. Перезапустите dev сервер если он запущен
2. Откройте профиль инфлюенсера
3. Нажмите "Подключить Instagram"
4. Авторизуйтесь через Instagram (Facebook не требуется!)
5. Вы будете перенаправлены обратно в приложение
6. Статус должен показать "Instagram подключен"

## Требования для инфлюенсеров

Каждый инфлюенсер должен:

1. **Иметь профессиональный аккаунт Instagram** (бесплатно)
   - Настройки → Account → Switch to Professional Account
   - Выбрать "Business" или "Creator"

2. **Авторизовать приложение** через кнопку "Подключить Instagram"
   - Facebook Page НЕ требуется!
   - Авторизация происходит напрямую через Instagram

## Возможности после подключения

С подключенным Instagram можно:

- ✅ Автоматически получать статистику постов (просмотры, охват, лайки)
- ✅ Отслеживать вовлеченность (engagement rate)
- ✅ Получать данные о подписчиках
- ✅ Проверять выполнение заданий без ручного ввода

## Ограничения

- Токены живут 60 дней, после чего нужно обновлять (refresh)
- Статистика доступна только для профессиональных аккаунтов (Business/Creator)
- Facebook Page НЕ требуется
- Для статистики постов пост должен быть опубликован через профессиональный аккаунт
- Метрики `plays`, `impressions` устарели с v22.0 — используется `views`

## API Endpoints (новый Instagram Login)

| Действие | Endpoint |
|----------|----------|
| OAuth авторизация | `https://www.instagram.com/oauth/authorize` |
| Обмен кода на токен | `https://api.instagram.com/oauth/access_token` |
| Long-lived токен | `https://graph.instagram.com/access_token` |
| Обновление токена | `https://graph.instagram.com/refresh_access_token` |
| Профиль / медиа / insights | `https://graph.instagram.com/v22.0/...` |

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
