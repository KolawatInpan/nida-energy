/** @type {import('tailwindcss').Config} */
module.exports = {
  important: true, // Makes all Tailwind utilities !important
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
