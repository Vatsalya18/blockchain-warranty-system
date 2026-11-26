/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: "#F8F9FA",
        tealHero: {
          DEFAULT: "#0D7E6B",
          hover: "#0B6858",
          light: "#E6F4F1",
        },
        pastel: {
          peach: "#FDF5EC",
          peachBorder: "#F8D7BE",
          lavender: "#EEF2FF",
          lavenderBorder: "#D0D7F7",
          mint: "#F0FDF4",
          mintBorder: "#C6F6D5",
          sky: "#F0F9FF",
          skyBorder: "#BAE6FD",
          coral: "#FEF2F2",
          coralBorder: "#FECACA",
        },
      },
      fontFamily: {
        sans: ["'Plus Jakarta Sans'", "Inter", "sans-serif"],
      },
      borderRadius: {
        "2xl": "16px",
        "3xl": "24px",
      },
    },
  },
  plugins: [],
};
