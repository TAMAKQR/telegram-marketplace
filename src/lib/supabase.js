import { createClient } from '@supabase/supabase-js'

import { getEnv } from './runtimeConfig'

const supabaseUrl = getEnv('VITE_SUPABASE_URL')
const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY')

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables. Please check your .env file.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
        headers: supabaseUrl?.includes('ngrok-free.app')
            ? { 'ngrok-skip-browser-warning': 'true' }
            : {},
    },
    auth: {
        persistSession: false,
        autoRefreshToken: false
    }
})
