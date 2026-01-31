// @ts-nocheck
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'

type Action = 'exchange_code' | 'long_lived'
type PingAction = 'ping'

type Body =
    | { action: 'exchange_code'; code: string }
    | { action: 'long_lived'; shortToken: string }

function requiredEnv(name: string): string {
    const v = Deno.env.get(name)
    if (!v) throw new Error(`Missing ${name}`)
    return v
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }

    try {
        const raw = await req.text()
        if (!raw || !raw.trim()) {
            return new Response(JSON.stringify({ error: 'Missing JSON body' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        let body: any
        try {
            body = JSON.parse(raw)
        } catch {
            return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        const action = body?.action as (Action | PingAction | undefined)

        if (action === 'ping') {
            return new Response(JSON.stringify({ ok: true }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        const appId = requiredEnv('INSTAGRAM_APP_ID')
        const appSecret = requiredEnv('INSTAGRAM_APP_SECRET')
        const redirectUri = requiredEnv('INSTAGRAM_REDIRECT_URI')

        if (action === 'exchange_code') {
            const code = body?.code
            if (!code || typeof code !== 'string') {
                return new Response(JSON.stringify({ error: 'Missing code' }), {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                })
            }

            const formData = new URLSearchParams({
                client_id: appId,
                client_secret: appSecret,
                grant_type: 'authorization_code',
                redirect_uri: redirectUri,
                code,
            })

            const response = await fetch('https://graph.facebook.com/v18.0/oauth/access_token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: formData,
            })

            const data = await response.json()

            return new Response(JSON.stringify(data), {
                status: response.ok ? 200 : 502,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        if (action === 'long_lived') {
            const shortToken = body?.shortToken
            if (!shortToken || typeof shortToken !== 'string') {
                return new Response(JSON.stringify({ error: 'Missing shortToken' }), {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                })
            }

            const params = new URLSearchParams({
                grant_type: 'ig_exchange_token',
                client_secret: appSecret,
                access_token: shortToken,
            })

            const response = await fetch(`https://graph.instagram.com/access_token?${params}`)
            const data = await response.json()

            return new Response(JSON.stringify(data), {
                status: response.ok ? 200 : 502,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        return new Response(JSON.stringify({ error: 'Unknown action' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    } catch (e) {
        return new Response(JSON.stringify({ error: String(e) }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
})
