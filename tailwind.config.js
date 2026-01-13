/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                'sans': ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
            },
            colors: {
                'tg-bg': 'var(--tg-theme-bg-color)',
                'tg-text': 'var(--tg-theme-text-color)',
                'tg-hint': 'var(--tg-theme-hint-color)',
                'tg-link': 'var(--tg-theme-link-color)',
                'tg-button': 'var(--tg-theme-button-color)',
                'tg-button-text': 'var(--tg-theme-button-text-color)',
            }
        },
    },
    plugins: [],
}
