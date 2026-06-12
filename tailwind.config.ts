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
          500: "#1F7A52",
          600: "#176342",
          700: "#114E34",
          800: "#0C3A27",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(12,12,13,0.04), 0 8px 24px -12px rgba(12,12,13,0.10)",
        lift: "0 2px 4px rgba(12,12,13,0.05), 0 16px 40px -16px rgba(12,12,13,0.18)",
      },
      borderRadius: {
        "2xl": "1rem",
      },
    },
  },
  plugins: [],
};
export default config;
