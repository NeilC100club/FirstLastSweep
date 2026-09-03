import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        pitch: "#FFFFFF",
        pitchDark: "#FBEBD2",
        chalk: "#161412",
        gold: "#F2A900",
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
