import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0C0C0D",
        paper: "#FAFAF9",
        mist: "#F1F1EF",
        line: "#E4E4E2",
        turf: {
          50: "#EDF5F0",
          100: "#DCEBE2",
          200: "#B9D7C6",
          300: "#83B798",
          400: "#438D66",
          500: "#1F7A52",
          600: "#176342",
          700: "#114E34",
          800: "#0C3A27",
          900: "#07271B",
          950: "#031A11",
        },
        gold: {
          50: "#FBF7EC",
          100: "#F5EBCF",
          200: "#E9D49E",
          300: "#D8B96A",
          400: "#C79B42",
          500: "#A97929",
          700: "#71501D",
          800: "#583E1B",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(12,12,13,0.04), 0 8px 24px -12px rgba(12,12,13,0.10)",
        lift: "0 2px 4px rgba(12,12,13,0.05), 0 16px 40px -16px rgba(12,12,13,0.18)",
        premium: "0 24px 80px -32px rgba(5, 12, 8, 0.38)",
      },
      borderRadius: {
        "2xl": "1rem",
      },
    },
  },
  plugins: [],
};
export default config;
