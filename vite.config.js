import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const buildTimestamp = Date.now()

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    define: {
        __BUILD_TIMESTAMP__: JSON.stringify(buildTimestamp)
    },
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
                entryFileNames: `assets/[name].[hash].${buildTimestamp}.js`,
                chunkFileNames: `assets/[name].[hash].${buildTimestamp}.js`,
                assetFileNames: `assets/[name].[hash].${buildTimestamp}.[ext]`
            }
        }
    }
})
