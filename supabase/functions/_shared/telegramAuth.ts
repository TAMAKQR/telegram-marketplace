function toHex(buffer: ArrayBuffer): string {
    return Array.from(new Uint8Array(buffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
}

async function sha256(data: string): Promise<ArrayBuffer> {
    const enc = new TextEncoder()
    return await crypto.subtle.digest('SHA-256', enc.encode(data))
}

async function hmacSha256(key: ArrayBuffer, data: string): Promise<ArrayBuffer> {
    const enc = new TextEncoder()
    const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    return await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(data))
}

export async function verifyTelegramInitData(
    initData: string,
    botToken: string,
    maxAgeSeconds = 24 * 60 * 60,
): Promise<{ ok: true; userId?: number } | { ok: false; reason: string }> {
    if (!initData) return { ok: false, reason: 'missing_init_data' }

    const params = new URLSearchParams(initData)
    const hash = params.get('hash')
    const authDate = params.get('auth_date')

    if (!hash) return { ok: false, reason: 'missing_hash' }
    if (!authDate) return { ok: false, reason: 'missing_auth_date' }

    const authDateNum = Number(authDate)
    if (!Number.isFinite(authDateNum)) return { ok: false, reason: 'invalid_auth_date' }

    const now = Math.floor(Date.now() / 1000)
    if (maxAgeSeconds > 0 && now - authDateNum > maxAgeSeconds) {
        return { ok: false, reason: 'expired' }
    }

    // data_check_string: sort key=value by key, excluding hash
    const pairs: string[] = []
    for (const [key, value] of params.entries()) {
        if (key === 'hash') continue
        pairs.push(`${key}=${value}`)
    }
    pairs.sort((a, b) => a.localeCompare(b))
    const dataCheckString = pairs.join('\n')

    // secret_key = sha256(bot_token)
    const secretKey = await sha256(botToken)
    const signature = await hmacSha256(secretKey, dataCheckString)
    const expectedHash = toHex(signature)

    if (expectedHash !== hash) {
        return { ok: false, reason: 'hash_mismatch' }
    }

    const userRaw = params.get('user')
    if (userRaw) {
        try {
            const user = JSON.parse(userRaw)
            if (typeof user?.id === 'number') return { ok: true, userId: user.id }
        } catch {
            // ignore parsing errors
        }
    }

    return { ok: true }
}
