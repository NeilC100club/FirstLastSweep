import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        pitch: "#FFFFFF",
        pitchDark: "#DFF3DF",
        chalk: "#173620",
        gold: "#C9A227",
        red: "#B3412C",
      },
      fontFamily: {
        display: ["'Archivo Black'", "Impact", "sans-serif"],
        mono: ["'IBM Plex Mono'", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
