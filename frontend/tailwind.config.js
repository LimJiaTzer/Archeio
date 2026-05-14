/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        toolbox: {
          beige: '#F5F5DC',
          brown: '#8B5A2B',
          dark: '#5C4033',
        }
      }
    },
  },
  plugins: [],
}
