/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#ecfeff",
          100: "#cffafe",
          200: "#a5f3fc",
          300: "#67e8f9",
          400: "#22d3ee",
          500: "#06b6d4",
          600: "#0891b2",
          700: "#0e7490",
          800: "#155e75",
          900: "#164e63",
          950: "#083344",
        },
        surface: {
          DEFAULT: "#06070b",
          card:    "#0e1118",
          border:  "rgba(255,255,255,0.07)",
          hover:   "#151922",
        },
      },
      fontFamily: {
        sans: ["Plus Jakarta Sans", "system-ui", "sans-serif"],
        display: ["Instrument Serif", "Georgia", "serif"],
        mono: ["IBM Plex Mono", "JetBrains Mono", "monospace"],
      },
      animation: {
        "fade-in":    "fadeIn 0.28s ease-out",
        "slide-up":   "slideUp 0.32s cubic-bezier(0.16, 1, 0.3, 1)",
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "spin-slow":  "spin 2s linear infinite",
      },
      keyframes: {
        fadeIn:  { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        slideUp: { "0%": { opacity: "0", transform: "translateY(10px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
      },
    },
  },
  plugins: [],
}
