/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                'iso-ground': '#f0f4f8',
                'iso-road': '#cbd5e0',
                'iso-building': '#4a5568',
                'iso-building-roof': '#cbd5e0',
            }
        },
    },
    plugins: [],
}
