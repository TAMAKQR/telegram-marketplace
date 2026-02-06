// Сервис для работы с Instagram Graph API
import { getEnv } from './runtimeConfig'

const INSTAGRAM_APP_ID = getEnv('VITE_INSTAGRAM_APP_ID')

function resolveRedirectUri() {
    // Always infer from current origin to avoid ngrok/env mismatch.
    if (typeof window !== 'undefined' && window.location?.origin) {
        return `${window.location.origin}/instagram/callback`
    }

    // Fallback for non-browser environments
    return getEnv('VITE_INSTAGRAM_REDIRECT_URI', '')
}

function base64UrlEncode(utf8String) {
    // btoa expects binary string; convert from UTF-8 first.
    const bin = unescape(encodeURIComponent(utf8String))
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function buildOAuthState(userId, redirectUri) {
    // Keep backward compatibility: if something goes wrong, return userId.
    try {
        return base64UrlEncode(JSON.stringify({ v: 1, uid: userId, ru: redirectUri }))
    } catch {
        return String(userId)
    }
}

export const instagramService = {
    // Получить URL для OAuth авторизации
    getAuthUrl(userId) {
        if (!INSTAGRAM_APP_ID) {
            throw new Error('Missing VITE_INSTAGRAM_APP_ID')
        }

        const redirectUri = resolveRedirectUri()

        if (!redirectUri) {
            throw new Error('Missing VITE_INSTAGRAM_REDIRECT_URI (could not infer default)')
        }

        // Используем Instagram Business Login (без Facebook)
        // Скоупы: instagram_business_basic + instagram_business_manage_insights
        const params = new URLSearchParams({
            client_id: INSTAGRAM_APP_ID,
            redirect_uri: redirectUri,
            scope: 'instagram_business_basic,instagram_business_manage_insights',
            response_type: 'code',
            // Encode redirectUri in state so code exchange can use the same value.
            state: buildOAuthState(userId, redirectUri)
        })

        // Instagram OAuth напрямую (без Facebook)
        return `https://www.instagram.com/oauth/authorize?${params}`
    },

    // Обменять код авторизации на токен доступа
    async exchangeCodeForToken(code, redirectUriOverride = undefined) {
        const { supabase } = await import('./supabase')

        const redirectUri = redirectUriOverride || resolveRedirectUri()

        const { data, error } = await supabase.functions.invoke('instagram-oauth', {
            body: {
                action: 'exchange_code',
                code,
                redirectUri
            }
        })

        if (error) {
            console.error('instagram-oauth function error:', error)
            throw new Error('Failed to exchange code for token')
        }

        if (data?.ok === false) {
            const upstreamMessage = data?.upstream?.error?.message || data?.upstream?.error_message
            const usedRedirect = data?.used_redirect_uri ? `redirect_uri: ${data.used_redirect_uri}` : null
            const usedAppId = data?.used_app_id ? `app_id: ${data.used_app_id}` : null
            const upstreamStatus = data?.upstream_status ? `upstream_status: ${data.upstream_status}` : null
            const hintParts = [usedAppId, usedRedirect, upstreamStatus].filter(Boolean)
            const hint = hintParts.length ? ` (${hintParts.join(', ')})` : ''
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
        // Используем Instagram Graph API напрямую
        const fields = 'id,username,name,biography,followers_count,follows_count,media_count,profile_picture_url'
        const response = await fetch(
            `https://graph.instagram.com/v22.0/${userId}?fields=${fields}&access_token=${accessToken}`
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
            `https://graph.instagram.com/v22.0/${mediaId}/insights?metric=${metrics}&access_token=${accessToken}`
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
            `https://graph.instagram.com/v22.0/${mediaId}?fields=${fields}&access_token=${accessToken}`
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
