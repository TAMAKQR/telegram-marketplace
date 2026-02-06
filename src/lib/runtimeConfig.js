function readRuntimeEnv() {
    if (typeof window === 'undefined') return null

    // Primary: our Docker-injected config
    if (window.__ENV__ && typeof window.__ENV__ === 'object') return window.__ENV__

    // Secondary: allow alternative names if needed
    if (window.__RUNTIME_CONFIG__ && typeof window.__RUNTIME_CONFIG__ === 'object') return window.__RUNTIME_CONFIG__

    return null
}

function readViteEnv(key) {
    // In production builds Vite reliably replaces direct property accesses
    // (e.g. import.meta.env.VITE_SUPABASE_URL), but NOT dynamic indexing
    // (e.g. import.meta.env[key]). So we keep an explicit map.
    const env = import.meta.env

    const mapped = {
        VITE_SUPABASE_URL: env.VITE_SUPABASE_URL,
        VITE_SUPABASE_ANON_KEY: env.VITE_SUPABASE_ANON_KEY,

        VITE_INSTAGRAM_APP_ID: env.VITE_INSTAGRAM_APP_ID,
        VITE_INSTAGRAM_REDIRECT_URI: env.VITE_INSTAGRAM_REDIRECT_URI,

        VITE_TELEGRAM_GROUP_CHAT_ID: env.VITE_TELEGRAM_GROUP_CHAT_ID,
        VITE_TELEGRAM_BOT_USERNAME: env.VITE_TELEGRAM_BOT_USERNAME,
        VITE_TELEGRAM_WEBAPP_SHORT_NAME: env.VITE_TELEGRAM_WEBAPP_SHORT_NAME,
    }

    if (Object.prototype.hasOwnProperty.call(mapped, key)) {
        return mapped[key]
    }

    // Dev-only fallback: import.meta.env is a real object at runtime.
    try {
        return env?.[key]
    } catch {
        return undefined
    }
}

export function getEnv(key, fallback = undefined) {
    const runtime = readRuntimeEnv()

    if (runtime && Object.prototype.hasOwnProperty.call(runtime, key)) {
        const value = runtime[key]
        if (value !== undefined && value !== null && String(value).length > 0) return String(value)
    }

    const viteValue = readViteEnv(key)
    if (viteValue !== undefined && viteValue !== null && String(viteValue).length > 0) return String(viteValue)

    return fallback
}
