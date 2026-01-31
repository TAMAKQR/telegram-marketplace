// Сервис для работы с Instagram Graph API
const INSTAGRAM_APP_ID = import.meta.env.VITE_INSTAGRAM_APP_ID
const DEFAULT_REDIRECT_URI = typeof window !== 'undefined'
    ? `${window.location.origin}/instagram/callback`
    : ''
const REDIRECT_URI = import.meta.env.VITE_INSTAGRAM_REDIRECT_URI || DEFAULT_REDIRECT_URI

export const instagramService = {
    // Получить URL для OAuth авторизации
    getAuthUrl(userId) {
        if (!INSTAGRAM_APP_ID) {
            throw new Error('Missing VITE_INSTAGRAM_APP_ID')
        }

        if (!REDIRECT_URI) {
            throw new Error('Missing VITE_INSTAGRAM_REDIRECT_URI (could not infer default)')
        }

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
        const { supabase } = await import('./supabase')

        const { data, error } = await supabase.functions.invoke('instagram-oauth', {
            body: {
                action: 'exchange_code',
                code
            }
        })

        if (error) {
            console.error('instagram-oauth function error:', error)
            throw new Error('Failed to exchange code for token')
        }

        if (data?.ok === false) {
            const upstreamMessage = data?.upstream?.error?.message || data?.upstream?.error_message
            const hint = data?.used_redirect_uri ? ` (redirect_uri: ${data.used_redirect_uri})` : ''
            throw new Error(upstreamMessage ? `${upstreamMessage}${hint}` : `Failed to exchange code for token${hint}`)
        }

        const result = data?.result ?? data

        return {
            accessToken: result.access_token,
            userId: result.user_id
        }
    },

    // Получить долгосрочный токен (60 дней)
    async getLongLivedToken(shortToken) {
        const { supabase } = await import('./supabase')

        const { data, error } = await supabase.functions.invoke('instagram-oauth', {
            body: {
                action: 'long_lived',
                shortToken
            }
        })

        if (error) {
            console.error('instagram-oauth function error:', error)
            throw new Error('Failed to get long-lived token')
        }

        if (data?.ok === false) {
            const upstreamMessage = data?.upstream?.error?.message || data?.upstream?.error_message
            throw new Error(upstreamMessage || 'Failed to get long-lived token')
        }

        const result = data?.result ?? data

        return {
            accessToken: result.access_token,
            expiresIn: result.expires_in // seconds (обычно 5184000 = 60 дней)
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
            'reach',
            'saved',
            'shares',
            'views'
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

    // Получить последние посты пользователя через Supabase RPC
    async getUserMedia(accessToken, userId, limit = 25) {
        const { supabase } = await import('./supabase')

        // Используем Supabase RPC функцию вместо прямого API запроса
        const { data, error } = await supabase.rpc('fetch_user_instagram_media', {
            p_access_token: accessToken,
            p_instagram_user_id: userId,
            p_limit: limit
        })

        if (error) {
            console.error('Supabase RPC error:', error)
            throw new Error('Failed to fetch user media via Supabase')
        }

        // Проверяем на ошибку от Instagram API
        if (data && data.error) {
            console.error('Instagram API error:', data)
            throw new Error(data.message || 'Instagram API error')
        }

        return data
    },

    // Найти пост по URL
    async findMediaByUrl(accessToken, userId, postUrl) {
        const media = await this.getUserMedia(accessToken, userId, 100)
        return media.data.find(post => post.permalink === postUrl)
    }
}
