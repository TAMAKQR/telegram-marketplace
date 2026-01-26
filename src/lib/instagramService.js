// Сервис для работы с Instagram Graph API
const INSTAGRAM_APP_ID = import.meta.env.VITE_INSTAGRAM_APP_ID
const INSTAGRAM_APP_SECRET = import.meta.env.VITE_INSTAGRAM_APP_SECRET
const REDIRECT_URI = import.meta.env.VITE_INSTAGRAM_REDIRECT_URI || 'https://cec8671fc594.ngrok-free.app/instagram/callback'

export const instagramService = {
    // Получить URL для OAuth авторизации
    getAuthUrl(userId) {
        // Запрашиваем разрешения для Instagram Business аккаунтов
        // Добавляем pages_read_engagement для получения instagram_business_account
        const params = new URLSearchParams({
            client_id: INSTAGRAM_APP_ID,
            redirect_uri: REDIRECT_URI,
            scope: 'instagram_basic,pages_show_list,pages_read_engagement,instagram_manage_insights,business_management',
            response_type: 'code',
            state: userId // Передаем user ID через state
        })

        // Используем Facebook OAuth
        return `https://www.facebook.com/v18.0/dialog/oauth?${params}`
    },

    // Обменять код авторизации на токен доступа
    async exchangeCodeForToken(code) {
        const formData = new URLSearchParams({
            client_id: INSTAGRAM_APP_ID,
            client_secret: INSTAGRAM_APP_SECRET,
            grant_type: 'authorization_code',
            redirect_uri: REDIRECT_URI,
            code: code
        })

        // Используем Facebook Graph API для обмена кода
        const response = await fetch('https://graph.facebook.com/v18.0/oauth/access_token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData
        })

        if (!response.ok) {
            throw new Error('Failed to exchange code for token')
        }

        const data = await response.json()
        return {
            accessToken: data.access_token,
            userId: data.user_id
        }
    },

    // Получить долгосрочный токен (60 дней)
    async getLongLivedToken(shortToken) {
        const params = new URLSearchParams({
            grant_type: 'ig_exchange_token',
            client_secret: INSTAGRAM_APP_SECRET,
            access_token: shortToken
        })

        const response = await fetch(`https://graph.instagram.com/access_token?${params}`)
        const data = await response.json()

        return {
            accessToken: data.access_token,
            expiresIn: data.expires_in // seconds (обычно 5184000 = 60 дней)
        }
    },

    // Обновить токен (делать каждые 60 дней)
    async refreshToken(token) {
        const params = new URLSearchParams({
            grant_type: 'ig_refresh_token',
            access_token: token
        })

        const response = await fetch(`https://graph.instagram.com/refresh_access_token?${params}`)
        const data = await response.json()

        return {
            accessToken: data.access_token,
            expiresIn: data.expires_in
        }
    },

    // Получить профиль пользователя
    async getUserProfile(accessToken, userId) {
        // Для Instagram Business Account используем Facebook Graph API
        const fields = 'id,username,name,biography,followers_count,follows_count,media_count,profile_picture_url'
        const response = await fetch(
            `https://graph.facebook.com/v18.0/${userId}?fields=${fields}&access_token=${accessToken}`
        )

        if (!response.ok) {
            const errorData = await response.json()
            console.error('Instagram API Error:', errorData)
            throw new Error(`Failed to fetch user profile: ${JSON.stringify(errorData)}`)
        }

        return response.json()
    },

    // Получить статистику конкретного поста
    async getMediaInsights(accessToken, mediaId) {
        const metrics = [
            'engagement',
            'impressions',
            'reach',
            'saved',
            'video_views' // для видео
        ].join(',')

        const response = await fetch(
            `https://graph.facebook.com/v18.0/${mediaId}/insights?metric=${metrics}&access_token=${accessToken}`
        )

        if (!response.ok) {
            throw new Error('Failed to fetch media insights')
        }

        const data = await response.json()

        // Преобразуем в удобный формат
        const insights = {}
        data.data.forEach(item => {
            insights[item.name] = item.values[0].value
        })

        return insights
    },

    // Получить информацию о посте
    async getMediaInfo(accessToken, mediaId) {
        const fields = 'id,caption,media_type,media_url,permalink,thumbnail_url,timestamp,like_count,comments_count'
        const response = await fetch(
            `https://graph.facebook.com/v18.0/${mediaId}?fields=${fields}&access_token=${accessToken}`
        )

        if (!response.ok) {
            throw new Error('Failed to fetch media info')
        }

        return response.json()
    },

    // Получить последние посты пользователя
    async getUserMedia(accessToken, userId, limit = 25) {
        const fields = 'id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count'
        const response = await fetch(
            `https://graph.facebook.com/v18.0/${userId}/media?fields=${fields}&limit=${limit}&access_token=${accessToken}`
        )

        if (!response.ok) {
            throw new Error('Failed to fetch user media')
        }

        return response.json()
    },

    // Найти пост по URL
    async findMediaByUrl(accessToken, userId, postUrl) {
        const media = await this.getUserMedia(accessToken, userId, 100)
        return media.data.find(post => post.permalink === postUrl)
    }
}
