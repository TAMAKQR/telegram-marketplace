// @ts-nocheck
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { verifyTelegramInitData } from '../_shared/telegramAuth.ts'

type Body = {
    chatId?: string | number
    message: string
    parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2'
    disableWebPreview?: boolean
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')
        if (!botToken) {
            return new Response(JSON.stringify({ error: 'Missing TELEGRAM_BOT_TOKEN' }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        const allowUnauthenticated = Deno.env.get('ALLOW_UNAUTHENTICATED') === 'true'
        if (!allowUnauthenticated) {
            const initData = req.headers.get('x-telegram-init-data') || ''
            const auth = await verifyTelegramInitData(initData, botToken)
            if (!auth.ok) {
                return new Response(JSON.stringify({ error: 'Unauthorized', reason: auth.reason }), {
                    status: 401,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                })
            }
        }

        const defaultChatId = Deno.env.get('TELEGRAM_GROUP_CHAT_ID')

        const raw = await req.text()
        if (!raw || !raw.trim()) {
            return new Response(JSON.stringify({ error: 'Missing JSON body' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        let body: Body
        try {
            body = JSON.parse(raw) as Body
        } catch {
            return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }
        if (!body?.message || typeof body.message !== 'string') {
            return new Response(JSON.stringify({ error: 'Missing message' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        if (body.message.length > 4096) {
            return new Response(JSON.stringify({ error: 'Message too long' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        const chatId = body.chatId ?? defaultChatId
        if (!chatId) {
            return new Response(JSON.stringify({ error: 'Missing chatId and TELEGRAM_GROUP_CHAT_ID' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: body.message,
                parse_mode: body.parseMode ?? 'HTML',
                disable_web_page_preview: body.disableWebPreview ?? true,
            }),
        })

        const result = await telegramResponse.json()

        return new Response(JSON.stringify(result), {
            status: telegramResponse.ok ? 200 : 502,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    } catch (e) {
        return new Response(JSON.stringify({ error: String(e) }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
})
