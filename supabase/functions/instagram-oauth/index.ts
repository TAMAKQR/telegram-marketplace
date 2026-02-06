// @ts-nocheck
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'

type Action = 'exchange_code' | 'long_lived'
type PingAction = 'ping'

type Body =
    | { action: 'exchange_code'; code: string; redirectUri?: string }
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
        const defaultRedirectUri = requiredEnv('INSTAGRAM_REDIRECT_URI')

        if (action === 'exchange_code') {
            const code = body?.code
            if (!code || typeof code !== 'string') {
                return new Response(JSON.stringify({ error: 'Missing code' }), {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                })
            }

            const origin = req.headers.get('origin')
            const inferredRedirectUri = (origin && origin.startsWith('https://') && !origin.includes(' '))
                ? `${origin.replace(/\/$/, '')}/instagram/callback`
                : null

            const candidateRedirectUri = body?.redirectUri
            const bodyRedirectUri = (typeof candidateRedirectUri === 'string'
                && candidateRedirectUri.trim().length > 0
                && candidateRedirectUri.startsWith('https://')
                && candidateRedirectUri.endsWith('/instagram/callback')
                && !candidateRedirectUri.includes(' '))
                ? candidateRedirectUri
                : null

            const redirectUri = inferredRedirectUri || bodyRedirectUri || defaultRedirectUri

            const formData = new URLSearchParams({
                client_id: appId,
                client_secret: appSecret,
                grant_type: 'authorization_code',
                redirect_uri: redirectUri,
                code,
            })

            // Instagram Business Login: exchange code via Instagram API directly
            const response = await fetch('https://api.instagram.com/oauth/access_token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: formData,
            })

            const data = await response.json()

            if (!response.ok) {
                return new Response(
                    JSON.stringify({
                        ok: false,
                        stage: 'exchange_code',
                        used_app_id: appId,
                        upstream_status: response.status,
                        upstream: data,
                        used_redirect_uri: redirectUri,
                    }),
                    {
                        status: 200,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    },
                )
            }

            return new Response(
                JSON.stringify({
                    ok: true,
                    used_app_id: appId,
                    used_redirect_uri: redirectUri,
                    result: data,
                }),
                {
                    status: 200,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                },
            )
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

            if (!response.ok) {
                return new Response(
                    JSON.stringify({
                        ok: false,
                        stage: 'long_lived',
                        used_app_id: appId,
                        upstream_status: response.status,
                        upstream: data,
                    }),
                    {
                        status: 200,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    },
                )
            }

            return new Response(
                JSON.stringify({
                    ok: true,
                    used_app_id: appId,
                    result: data,
                }),
                {
                    status: 200,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                },
            )
        }

        return new Response(JSON.stringify({ error: 'Unknown action' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    } catch (e) {
        // Return 200 so the client can show the exact error message instead of a generic FunctionsHttpError.
        return new Response(JSON.stringify({ ok: false, stage: 'exception', error: String(e), used_app_id: Deno.env.get('INSTAGRAM_APP_ID') ?? null }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
})
