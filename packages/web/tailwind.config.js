/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",        // Scans your web/src folder
    "../../packages/shared/**/*.{js,ts,jsx,tsx}" // Scans your shared folder (adjust path logic if needed)
  ],
  theme: {
    extend: {
      borderRadius: {
        '4xl': '2rem',
      }
    },
  },
  plugins: [require("tailwindcss-animate")],
}