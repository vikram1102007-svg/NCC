/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          950: "#08121e",
          900: "#0d1b2a",
          800: "#14283e",
          700: "#1d3550"
        },
        olive: {
          700: "#4b5c34",
          600: "#5c6f40",
          200: "#dce4ce",
          100: "#eef2e6"
        },
        gold: {
          600: "#b88422",
          500: "#d9a742",
          400: "#e7bc62",
          100: "#fbf3df"
        }
      },
      fontFamily: {
        display: ['"Barlow Condensed"', "system-ui", "-apple-system", "sans-serif"],
        sans: ['"Inter"', "system-ui", "-apple-system", '"Segoe UI"', "sans-serif"]
      }
    }
  },
  plugins: []
};
