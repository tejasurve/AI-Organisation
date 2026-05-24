import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Inter",
          "sans-serif",
        ],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      colors: {
        // Office aesthetic — premium, operational, alive.
        floor: {
          950: "#0d1322",
          900: "#141b2d",
          800: "#1c2438",
          700: "#28324a",
        },
        accent: {
          DEFAULT: "#22d3ee",
          warm: "#f59e0b",
          danger: "#ef4444",
          ok: "#10b981",
        },
      },
      boxShadow: {
        glow: "0 0 24px -6px rgba(34, 211, 238, 0.55)",
        glowDanger: "0 0 24px -6px rgba(239, 68, 68, 0.55)",
        glowOk: "0 0 24px -6px rgba(16, 185, 129, 0.55)",
      },
      keyframes: {
        pulseRing: {
          "0%": { transform: "scale(0.95)", opacity: "0.7" },
          "100%": { transform: "scale(1.4)", opacity: "0" },
        },
        scanline: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" },
        },
        flicker: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
      },
      animation: {
        pulseRing: "pulseRing 1.6s cubic-bezier(0.215, 0.61, 0.355, 1) infinite",
        scanline: "scanline 3s linear infinite",
        flicker: "flicker 0.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
