/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: {
          DEFAULT: "#001e2b",
          dark: "#00141d",
          soft: "#002433",
        },
        surface: {
          DEFAULT: "#002838",
          hover: "#00354a",
          active: "#003d4f",
          feature: "#004b61",
        },
        hairline: {
          DEFAULT: "#1c2d38",
          soft: "#15242e",
          strong: "#2a3e4d",
        },
        brand: {
          DEFAULT: "#00ed64",
          deep: "#00b545",
          pressed: "#008c34",
          soft: "#c3f0d2",
        },
        danger: {
          DEFAULT: "#fa6e39",
          deep: "#e0531c",
          surface: "rgba(250, 110, 57, 0.12)",
        },
        ink: {
          DEFAULT: "#f4f7f6",
          strong: "#ffffff",
          muted: "#a8b3bc",
          steel: "#6b7d8c",
        },
      },
      fontFamily: {
        sans: ["Segoe UI", "Inter", "system-ui", "sans-serif"],
        mono: ["Consolas", "Cascadia Code", "Source Code Pro", "monospace"],
      },
    },
  },
  plugins: [],
};
