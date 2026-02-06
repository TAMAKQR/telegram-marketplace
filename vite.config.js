import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const buildTimestamp = Date.now()

function runtimeEnvJsPlugin(mode) {
    const loaded = loadEnv(mode, process.cwd(), '')
    const payload = Object.fromEntries(
        Object.entries(loaded).filter(([k]) => k.startsWith('VITE_'))
    )

    const body =
        'window.__ENV__ = window.__ENV__ || {};\n' +
        `window.__ENV__ = Object.assign(window.__ENV__, ${JSON.stringify(payload)});\n`

    const handler = (req, res, next) => {
        const url = req.url ? req.url.split('?')[0] : ''
        if (url !== '/env.js') return next()

        res.statusCode = 200
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8')
        res.setHeader('Cache-Control', 'no-store')
        res.end(body)
    }

    return {
        name: 'runtime-env-js',
        configureServer(server) {
            server.middlewares.use(handler)
        },
        configurePreviewServer(server) {
            server.middlewares.use(handler)
        },
        generateBundle() {
            // Also output a real /env.js into dist for static hosting.
            // (For Docker/nginx this file is overwritten at container start.)
            this.emitFile({
                type: 'asset',
                fileName: 'env.js',
                source: body,
            })
        },
    }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
    plugins: [react(), runtimeEnvJsPlugin(mode)],
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
}))
