import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          base: "#080f0b",
          panel: "#0b1710",
          elevated: "#0f2719"
        },
        accent: {
          blue: "#3b82f6",
          cyan: "#10b981",
          green: "#22c55e",
          amber: "#fbbf24",
          red: "#f87171"
        },
        felt: {
          DEFAULT: "#0d4a2c",
          dark: "#0a3520",
          darker: "#071f14",
        },
        gold: {
          DEFAULT: "#f59e0b",
          light: "#fbbf24",
          dark: "#d97706",
        }
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(255,255,255,0.1), 0 18px 38px rgba(0,0,0,0.5)",
      },
      keyframes: {
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        pulseBorder: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(245,158,11,0.25)" },
          "50%": { boxShadow: "0 0 0 6px rgba(245,158,11,0)" }
        },
        glowPulse: {
          "0%, 100%": { boxShadow: "0 0 10px rgba(245, 158, 11, 0.35)" },
          "50%": { boxShadow: "0 0 30px rgba(245, 158, 11, 0.7), 0 0 60px rgba(245, 158, 11, 0.35)" }
        }
      },
      animation: {
        fadeInUp: "fadeInUp 320ms ease-out",
        pulseBorder: "pulseBorder 1.6s infinite",
        glowPulse: "glowPulse 2s ease-in-out infinite"
      },
      backgroundImage: {
        "table-grid": "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.05) 1px, transparent 0)"
      }
    }
  },
  plugins: [],
};

export default config;
