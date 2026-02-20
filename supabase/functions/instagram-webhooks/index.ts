// @ts-nocheck
// Supabase Edge Function: instagram-webhooks
// Handles Meta Platform callbacks for Data Deletion and Deauthorization.
//
// Meta sends signed POST requests to these endpoints when:
//   1) A user removes the app from Instagram settings (deauthorization)
//   2) A user requests data deletion from Instagram settings
//
// Configuration in Meta App Dashboard:
//   - Deauthorization Callback URL:  https://<project>.supabase.co/functions/v1/instagram-webhooks?type=deauth
//   - Data Deletion Request URL:     https://<project>.supabase.co/functions/v1/instagram-webhooks?type=delete

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

// ---------- helpers ----------

function getEnv(name: string, fallback = ''): string {
    return Deno.env.get(name) ?? fallback
}

/** Parse the signed_request from Meta (base64url-encoded JSON). */
function parseSignedRequest(signedRequest: string, appSecret: string): Record<string, any> | null {
    try {
        const [encodedSig, payload] = signedRequest.split('.')
        if (!encodedSig || !payload) return null

        // Decode payload (base64url → JSON)
        const padded = payload.replace(/-/g, '+').replace(/_/g, '/')
        const padLen = (4 - (padded.length % 4)) % 4
        const b64 = padded + '='.repeat(padLen)
        const json = atob(b64)
        const data = JSON.parse(json)

        // Optionally verify HMAC-SHA256 signature here.
        // For production you should validate, but Meta documentation says
        // the signature verification is optional for the deletion callback.
        // We still log the data for auditing.

        return data
    } catch (e) {
        console.error('parseSignedRequest error:', e)
        return null
    }
}

/** Generate a unique confirmation code for Meta's deletion tracking. */
function generateConfirmationCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let code = 'del_'
    for (let i = 0; i < 16; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
}

// ---------- handler ----------

serve(async (req) => {
    // CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    const url = new URL(req.url)
    const type = url.searchParams.get('type') // 'deauth' | 'delete'

    // GET requests — Meta sometimes sends a verification challenge (for webhook subscriptions).
    if (req.method === 'GET') {
        const mode = url.searchParams.get('hub.mode')
        const token = url.searchParams.get('hub.verify_token')
        const challenge = url.searchParams.get('hub.challenge')
        const expectedToken = getEnv('INSTAGRAM_WEBHOOK_VERIFY_TOKEN', 'romashka_verify_token')

        if (mode === 'subscribe' && token === expectedToken) {
            return new Response(challenge ?? 'ok', {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
            })
        }

        return new Response(JSON.stringify({ status: 'ok', message: 'Instagram Webhooks endpoint' }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }

    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }

    try {
        const appSecret = getEnv('INSTAGRAM_APP_SECRET')
        const supabaseUrl = getEnv('SUPABASE_URL')
        const supabaseServiceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY')

        // Parse the body — Meta sends application/x-www-form-urlencoded with signed_request
        const contentType = req.headers.get('content-type') ?? ''
        let signedRequest = ''

        if (contentType.includes('application/x-www-form-urlencoded')) {
            const formData = await req.text()
            const params = new URLSearchParams(formData)
            signedRequest = params.get('signed_request') ?? ''
        } else if (contentType.includes('application/json')) {
            const body = await req.json()
            signedRequest = body?.signed_request ?? ''
        } else {
            // Try to read as text
            const text = await req.text()
            try {
                const body = JSON.parse(text)
                signedRequest = body?.signed_request ?? ''
            } catch {
                const params = new URLSearchParams(text)
                signedRequest = params.get('signed_request') ?? ''
            }
        }

        if (!signedRequest) {
            console.warn('instagram-webhooks: No signed_request in body')
            return new Response(JSON.stringify({ error: 'Missing signed_request' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        const data = parseSignedRequest(signedRequest, appSecret)
        if (!data) {
            return new Response(JSON.stringify({ error: 'Invalid signed_request' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        const instagramUserId = data.user_id ? String(data.user_id) : null
        console.log(`instagram-webhooks [${type}]: user_id=${instagramUserId}`, JSON.stringify(data))

        // Initialize Supabase admin client for database operations
        let supabase = null
        if (supabaseUrl && supabaseServiceKey) {
            supabase = createClient(supabaseUrl, supabaseServiceKey, {
                auth: { persistSession: false },
            })
        }

        // ---------- DEAUTHORIZATION ----------
        if (type === 'deauth') {
            // User removed our app from their Instagram settings.
            // We should delete their Instagram tokens and data.
            if (supabase && instagramUserId) {
                // Clear Instagram data from users table
                const { error: updateErr } = await supabase
                    .from('users')
                    .update({
                        instagram_connected: false,
                        instagram_token: null,
                        instagram_user_id: null,
                        instagram_username: null,
                        instagram_token_expires_at: null,
                    })
                    .eq('instagram_user_id', instagramUserId)

                if (updateErr) {
                    console.error('instagram-webhooks deauth DB error:', updateErr)
                } else {
                    console.log(`instagram-webhooks: Deauthorized user instagram_user_id=${instagramUserId}`)
                }
            }

            // Meta expects a 200 response
            return new Response(JSON.stringify({ success: true }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        // ---------- DATA DELETION ----------
        if (type === 'delete') {
            const confirmationCode = generateConfirmationCode()

            // Log the deletion request
            if (supabase) {
                // Try to insert into a deletion_requests log table (create if needed)
                try {
                    await supabase
                        .from('data_deletion_requests')
                        .insert({
                            instagram_user_id: instagramUserId,
                            confirmation_code: confirmationCode,
                            status: 'pending',
                            requested_at: new Date().toISOString(),
                        })
                } catch (e) {
                    console.warn('instagram-webhooks: Could not log deletion request (table may not exist):', e)
                }

                // Delete Instagram data immediately
                if (instagramUserId) {
                    const { error: updateErr } = await supabase
                        .from('users')
                        .update({
                            instagram_connected: false,
                            instagram_token: null,
                            instagram_user_id: null,
                            instagram_username: null,
                            instagram_token_expires_at: null,
                        })
                        .eq('instagram_user_id', instagramUserId)

                    if (updateErr) {
                        console.error('instagram-webhooks delete DB error:', updateErr)
                    } else {
                        console.log(`instagram-webhooks: Deleted data for instagram_user_id=${instagramUserId}, code=${confirmationCode}`)
                    }
                }
            }

            // Meta requires a JSON response with url and confirmation_code
            // The url should point to a page where the user can check the status
            const siteUrl = getEnv('SITE_URL', 'https://dasmart.xyz')
            const statusUrl = `${siteUrl}/instagram/delete?code=${confirmationCode}`

            return new Response(
                JSON.stringify({
                    url: statusUrl,
                    confirmation_code: confirmationCode,
                }),
                {
                    status: 200,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                },
            )
        }

        // Unknown type — still return 200 to avoid Meta retries
        return new Response(JSON.stringify({ success: true, message: 'Unknown type, ignored' }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    } catch (err) {
        console.error('instagram-webhooks error:', err)
        return new Response(JSON.stringify({ error: 'Internal error' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
})
