// Сервис для получения метрик Instagram постов

export const instagramMetricsService = {
    async resolveInstagramUserId(accessToken) {
        try {
            const pagesResponse = await fetch(
                `https://graph.facebook.com/v18.0/me/accounts?fields=instagram_business_account{id,username}&access_token=${accessToken}`
            )

            if (!pagesResponse.ok) return null

            const pagesData = await pagesResponse.json()
            const pageWithIg = pagesData?.data?.find(p => p?.instagram_business_account?.id)
            return pageWithIg?.instagram_business_account?.id || null
        } catch {
            return null
        }
    },

    // Получить метрики поста по URL
    async getPostMetrics(accessToken, postUrl, instagramUserId = null) {
        try {
            // Извлекаем shortcode из URL поста
            // Примеры URL:
            // https://www.instagram.com/p/ABC123/
            // https://www.instagram.com/reel/XYZ789/
            const match = postUrl.match(/instagram\.com\/(p|reel)\/([A-Za-z0-9_-]+)/)

            if (!match) {
                throw new Error('Неверный формат URL поста Instagram')
            }

            const shortcode = match[2]

            // Получаем ID медиа по shortcode.
            // Для Instagram Graph API правильный путь: /{ig-user-id}/media
            const resolvedInstagramUserId = instagramUserId || await this.resolveInstagramUserId(accessToken)

            if (!resolvedInstagramUserId) {
                throw new Error('Не удалось определить instagramUserId (нужен бизнес/creator аккаунт и корректный токен)')
            }

            const mediaResponse = await fetch(
                `https://graph.facebook.com/v18.0/${resolvedInstagramUserId}/media?fields=id,shortcode,permalink&limit=100&access_token=${accessToken}`
            )

            if (!mediaResponse.ok) {
                const body = await mediaResponse.text().catch(() => '')
                throw new Error(`Не удалось получить список постов (${mediaResponse.status}): ${body}`)
            }

            const mediaData = await mediaResponse.json()

            // Находим пост по shortcode
            const media = mediaData.data?.find(m => m.shortcode === shortcode || m.permalink?.includes(shortcode))

            if (!media) {
                throw new Error('Пост не найден в вашем Instagram аккаунте')
            }

            // Получаем метрики поста
            return await this.getMediaMetrics(accessToken, media.id)

        } catch (error) {
            console.error('Error getting post metrics:', error)
            throw error
        }
    },

    // Получить метрики по ID медиа
    async getMediaMetrics(accessToken, mediaId) {
        try {
            // Получаем базовую информацию о посте
            const infoResponse = await fetch(
                `https://graph.facebook.com/v18.0/${mediaId}?fields=id,media_type,media_product_type,media_url,permalink,timestamp,like_count,comments_count&access_token=${accessToken}`
            )

            if (!infoResponse.ok) {
                throw new Error('Не удалось получить информацию о посте')
            }

            const info = await infoResponse.json()

            // Получаем insights (метрики) для поста
            let insights = null
            let views = 0
            let reach = 0

            try {
                // Для постов и reels
                if (info.media_type === 'IMAGE' || info.media_type === 'VIDEO' || info.media_type === 'CAROUSEL_ALBUM') {
                    // На разных типах медиа доступен разный набор метрик.
                    // Сначала пробуем расширенный набор (для Reels/видео), если упадёт — фоллбек на базовый.
                    let insightsData = null

                    const extendedInsightsResponse = await fetch(
                        `https://graph.facebook.com/v18.0/${mediaId}/insights?metric=views,reach,engagement,saved,shares&access_token=${accessToken}`
                    )

                    if (extendedInsightsResponse.ok) {
                        insightsData = await extendedInsightsResponse.json()
                    } else {
                        const fallbackInsightsResponse = await fetch(
                            `https://graph.facebook.com/v18.0/${mediaId}/insights?metric=reach,engagement,saved,shares&access_token=${accessToken}`
                        )
                        if (fallbackInsightsResponse.ok) {
                            insightsData = await fallbackInsightsResponse.json()
                        }
                    }

                    if (insightsData?.data) {
                        insights = this.parseInsights(insightsData.data)
                        views = insights?.views || 0
                        reach = insights?.reach || 0
                    }
                }

                // Для Stories
                if (info.media_type === 'STORY') {
                    const storyInsightsResponse = await fetch(
                        `https://graph.facebook.com/v18.0/${mediaId}/insights?metric=impressions,reach,replies,exits,taps_forward,taps_back&access_token=${accessToken}`
                    )

                    if (storyInsightsResponse.ok) {
                        const storyInsightsData = await storyInsightsResponse.json()
                        insights = this.parseInsights(storyInsightsData.data)
                    }
                }
            } catch (insightsError) {
                console.warn('Could not fetch insights:', insightsError)
                // Insights могут быть недоступны для старых постов или без business account
            }

            // Формируем результат
            return {
                media_id: mediaId,
                post_type: info.media_type === 'IMAGE' ? 'POST' :
                    info.media_product_type === 'REELS' ? 'REEL' :
                        info.media_type === 'VIDEO' ? 'REEL' :
                            info.media_type === 'STORY' ? 'STORY' : 'POST',
                permalink: info.permalink,
                timestamp: info.timestamp,

                // Базовые метрики (всегда доступны)
                likes_count: info.like_count || 0,
                comments_count: info.comments_count || 0,

                // Метрики из Insights (могут быть недоступны)
                views,
                reach,
                engagement: insights?.engagement || (info.like_count + info.comments_count),
                saves_count: insights?.saved || 0,
                shares_count: insights?.shares || 0,

                // Для Stories
                replies_count: insights?.replies || 0,
                exits_count: insights?.exits || 0,
                taps_forward: insights?.taps_forward || 0,
                taps_back: insights?.taps_back || 0,
            }

        } catch (error) {
            console.error('Error getting media metrics:', error)
            throw error
        }
    },

    // Парсинг insights от Instagram API
    parseInsights(insightsData) {
        const result = {}

        if (!insightsData || !Array.isArray(insightsData)) {
            return result
        }

        insightsData.forEach(insight => {
            const metric = insight.name
            const value = insight.values?.[0]?.value || 0
            result[metric] = value
        })

        return result
    },

    // Проверить доступность метрик для поста
    async checkMetricsAvailability(accessToken, mediaId) {
        try {
            const response = await fetch(
                `https://graph.facebook.com/v18.0/${mediaId}?fields=insights.metric(impressions)&access_token=${accessToken}`
            )

            return response.ok
        } catch {
            return false
        }
    },

    // Получить все посты инфлюенсера за последние N дней
    async getRecentPosts(accessToken, instagramUserId, days = 30) {
        try {
            const since = Math.floor(Date.now() / 1000) - (days * 24 * 60 * 60)

            const response = await fetch(
                `https://graph.facebook.com/v18.0/${instagramUserId}/media?fields=id,media_type,permalink,timestamp,like_count,comments_count&since=${since}&access_token=${accessToken}`
            )

            if (!response.ok) {
                throw new Error('Не удалось получить посты')
            }

            return await response.json()
        } catch (error) {
            console.error('Error getting recent posts:', error)
            throw error
        }
    }
}
