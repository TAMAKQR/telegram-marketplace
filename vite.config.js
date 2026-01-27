import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        host: true,
        allowedHosts: [
            '.ngrok-free.app',
            '.ngrok.io',
            '.ngrok.app',
            '.serveousercontent.com',
            '.loca.lt'
        ]
    },
    build: {
        outDir: 'dist',
        sourcemap: false,
        rollupOptions: {
            output: {
                // Добавляем timestamp к именам файлов для обхода кэша
                entryFileNames: `assets/[name].[hash].${Date.now()}.js`,
                chunkFileNames: `assets/[name].[hash].${Date.now()}.js`,
                assetFileNames: `assets/[name].[hash].${Date.now()}.[ext]`
            }
        }
    }
})
