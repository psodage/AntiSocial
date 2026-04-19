/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["DM Sans", "system-ui", "sans-serif"],
      },
      colors: {
        brand: {
          50: "#eef2ff",
          100: "#e0e7ff",
          400: "#7c8ff4",
          500: "#4a6cf7",
          600: "#3d5ce8",
        },
      },
      boxShadow: {
        card: "0 2px 12px rgba(17, 24, 39, 0.05)",
      },
    },
  },
  plugins: [],
};
