/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#2f9e44", 600: "#2b8a3e" },
      },
      boxShadow: {
        card: "0 10px 25px rgba(0,0,0,.08)",
      },
      keyframes: {
        indeterminate: {
          "0%": { transform: "translateX(-100%)" },
          "50%": { transform: "translateX(60%)" },
          "100%": { transform: "translateX(100%)" },
        },
        blink: {
          "0%, 20%": { opacity: "0" },
          "50%": { opacity: "1" },
          "100%": { opacity: "0" },
        },
      },
      animation: {
        indeterminate: "indeterminate 1.6s ease-in-out infinite",
        blink: "blink 1.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
