# Руководство по прохождению проверки Meta Business

## Обзор проблемы

У вас две отклонённые проверки в Meta Business:

1. **Подтверждение компании (Business Verification)** — Meta не смогла определить, принадлежит ли портфолио реальной компании
2. **Проверка поставщика технологических услуг (Tech Provider)** — не подтверждено, что компания является поставщиком технологических услуг

---

## Часть 1: Подтверждение компании (Business Verification)

### Необходимые документы

Для ИП в Кыргызской Республике подготовьте:

1. **Свидетельство о государственной регистрации ИП** (от Министерства юстиции КР)
   - Скан или фото в высоком качестве (PDF предпочтительнее)
   - Название должно **точно** совпадать с указанным в Meta: "Бейшенбеков Адамали Бейшенбекович"

2. **Паспорт владельца** (Бейшенбеков Адамали Бейшенбекович)
   - Разворот с фото, чётко видны ФИО и фото

3. **Свидетельство о постановке на налоговый учёт (ИНН)**
   - Номер 20407199901093 должен быть виден

4. **Подтверждение адреса** — один из вариантов:
   - Выписка из банка (не старше 3 месяцев)
   - Счёт за коммунальные услуги
   - Документ аренды/собственности на: мкр 12, дом 48, кв. 15, Бишкек

### Проверьте данные в Meta Business Settings

Убедитесь, что ВСЕ данные совпадают с документами:

| Поле | Должно быть |
|------|-------------|
| Зарегистрированное название | Точно как в свидетельстве о регистрации ИП |
| Адрес | Точно как в документах (формат Meta может отличаться — просто приблизьте максимально) |
| Телефон | +996700828234 (должен быть рабочий, Meta может позвонить) |
| ИНН | 20407199901093 |
| Сайт | https://dasmart.xyz/ |

### Процедура повторной подачи

1. Откройте [Meta Business Settings](https://business.facebook.com/settings/)
2. Перейдите в **Сведения о компании**
3. Нажмите **"Начать проверку"** или **"Повторная подача"**
4. Загрузите документы (свидетельство ИП + паспорт + ИНН)
5. Подтвердите телефон (Meta отправит код по SMS на +996700828234)
6. Дождитесь ответа (обычно 1-5 рабочих дней)

### Частые причины отказа

- Название компании не совпадает с документами (даже пробел имеет значение!)
- Документы нечёткие или обрезаны
- Адрес не совпадает с выпиской из банка
- Телефон не отвечает на SMS верификацию
- Сайт не работает или не содержит информации о компании

---

## Часть 2: Проверка поставщика технологических услуг (Tech Provider)

### Что уже сделано (технические исправления в коде)

✅ **Privacy Policy** (Политика конфиденциальности) — обновлена:
- Добавлены юридические реквизиты компании (ИП, ИНН, адрес)
- Добавлен двуязычный текст (англ./русский) — Meta рецензенты читают на английском
- Добавлены правовые основания обработки данных (Legal Basis)
- Детально описана интеграция с Instagram/Meta Platform
- Указаны конкретные разрешения Instagram API (`instagram_business_basic`, `instagram_business_manage_insights`)
- Добавлены сроки хранения данных (Data Retention)
- Указано, что данные НЕ продаются третьим лицам
- Добавлен раздел о правах пользователей (GDPR-стиль)
- Указан email для контакта (shoppingalanya@gmail.com)
- Добавлена ссылка на Meta Platform Terms

✅ **Terms of Service** (Условия использования) — обновлены:
- Добавлены юридические реквизиты
- Двуязычный текст
- Раздел о соответствии Meta Platform Terms
- Указано применимое право (Кыргызская Республика)
- Добавлен раздел о запрещённых действиях

✅ **Data Deletion Webhook** — создан серверный endpoint:
- Supabase Edge Function `instagram-webhooks`
- Обрабатывает signed_request от Meta
- Удаляет Instagram данные пользователя из БД
- Возвращает confirmation_code и URL для отслеживания
- Создана таблица `data_deletion_requests` для логирования

✅ **Deauthorization Webhook** — создан серверный endpoint:
- Обрабатывает удаление авторизации через тот же Edge Function
- Очищает Instagram tokens при деавторизации

✅ **Страницы InstagramDelete и InstagramDeauth** — обновлены:
- Показывают confirmation_code для отслеживания
- Содержат контактную информацию
- Профессиональный вид с иконками

### Что нужно сделать вам

#### 1. Задеплоить SQL миграцию

Выполните SQL из `supabase/migrations/migration_data_deletion_requests.sql` в Supabase SQL Editor:

```
https://supabase.com/dashboard/project/xpeyihbnsxcrybnuqsko/sql/new
```

#### 2. Задеплоить Edge Function

```powershell
npx supabase@latest functions deploy instagram-webhooks
```

#### 3. Установить секрет для webhook verify token

```powershell
npx supabase@latest secrets set INSTAGRAM_WEBHOOK_VERIFY_TOKEN="romashka_verify_token" SITE_URL="https://dasmart.xyz"
```

#### 4. Настроить URL-ы в Meta App Dashboard

Откройте [Meta App Dashboard](https://developers.facebook.com/apps/) → Ваше приложение → Instagram → Settings:

| Настройка | URL |
|-----------|-----|
| **Deauthorization Callback URL** | `https://xpeyihbnsxcrybnuqsko.supabase.co/functions/v1/instagram-webhooks?type=deauth` |
| **Data Deletion Request URL** | `https://xpeyihbnsxcrybnuqsko.supabase.co/functions/v1/instagram-webhooks?type=delete` |
| **Privacy Policy URL** | `https://dasmart.xyz/privacy` |
| **Terms of Service URL** | `https://dasmart.xyz/terms` |

> ⚠️ Замените `xpeyihbnsxcrybnuqsko` на ID вашего Supabase проекта если он другой.

#### 5. Задеплоить обновлённый фронтенд

```powershell
npm run build
# Затем задеплоить на Render / VPS
```

#### 6. Проверить что сайт работает

Убедитесь, что все эти URL-ы доступны:
- https://dasmart.xyz/ — главная страница
- https://dasmart.xyz/privacy — политика конфиденциальности  
- https://dasmart.xyz/terms — условия использования
- https://dasmart.xyz/instagram/delete — страница удаления данных
- https://dasmart.xyz/instagram/deauth — страница деавторизации

#### 7. Подать заявку на App Review

1. В Meta App Dashboard → **App Review** → **Permissions and Features**
2. Запросите:
   - `instagram_business_basic` → Advanced Access
   - `instagram_business_manage_insights` → Advanced Access
3. Для каждого разрешения нужно:
   - **Screencast (видео)** — запишите экран показывая как приложение использует Instagram данные
   - **Описание use case** — объясните что приложение:
     - Является платформой инфлюенсер-маркетинга
     - Рекламодатели создают задания
     - Инфлюенсеры подключают Instagram для отслеживания метрик постов
     - Метрики используются для автоматической проверки выполнения заданий
     - Оплата производится на основании фактических метрик

#### 8. Подать заявку на Tech Provider Verification

1. В Meta Business Settings → **Security Center**
2. Нажмите **"Start Verification"** для Technology Provider
3. Заполните форму:
   - **Business type**: Technology Service Provider / SaaS Platform
   - **Description**: "Romashka is an influencer marketing platform that helps advertisers (clients) create campaigns and track performance through Instagram Graph API. Influencers connect their Instagram Business accounts to allow the platform to verify campaign metrics (views, likes, engagement rate) automatically."
   - **Website**: https://dasmart.xyz
   - **Privacy Policy**: https://dasmart.xyz/privacy
   - **Terms of Service**: https://dasmart.xyz/terms

---

## Шаблоны текстов для Meta App Review

### Описание приложения (на английском)

```
Romashka is an influencer marketing platform that connects advertisers 
with social media influencers. 

How we use Instagram API:
- Influencers connect their Instagram Business/Creator accounts via 
  Instagram Business Login (OAuth 2.0)
- We use instagram_business_basic to read influencer profile info 
  (username, follower count, media list)
- We use instagram_business_manage_insights to read post metrics 
  (views, reach, likes, comments, engagement rate)
- These metrics are used to automatically verify that influencer has 
  completed the advertising task as specified by the client
- Payment to influencer is processed based on verified metrics

We do NOT:
- Post, edit, or delete any content on users' Instagram
- Store Instagram passwords
- Share Instagram data with third parties
- Use data for purposes other than campaign tracking

Users can disconnect their Instagram at any time, which immediately 
deletes all tokens and Instagram data from our system.
```

### Инструкции для видео-скринкаста

Запишите видео (1-3 минуты) показывая:
1. Как инфлюенсер открывает приложение в Telegram
2. Как нажимает "Подключить Instagram" 
3. Процесс авторизации через Instagram OAuth
4. Как отображаются метрики постов в приложении
5. Как клиент видит результаты кампании
6. Как инфлюенсер может отключить Instagram

---

## Контрольный список

- [ ] Документы для Business Verification подготовлены
- [ ] SQL миграция выполнена в Supabase
- [ ] Edge Function `instagram-webhooks` задеплоена
- [ ] Secrets установлены (INSTAGRAM_WEBHOOK_VERIFY_TOKEN, SITE_URL)
- [ ] Фронтенд обновлён и задеплоен
- [ ] URL-ы Callback настроены в Meta App Dashboard
- [ ] Privacy Policy URL указан в Meta App Dashboard
- [ ] Terms of Service URL указан в Meta App Dashboard
- [ ] Сайт https://dasmart.xyz работает
- [ ] Privacy Policy доступна по https://dasmart.xyz/privacy
- [ ] Terms of Service доступна по https://dasmart.xyz/terms
- [ ] Business Verification подана с документами
- [ ] App Review подан с видео и описанием
- [ ] Tech Provider Verification подана
