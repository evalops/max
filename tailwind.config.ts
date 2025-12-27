import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Warm paper tones
        paper: {
          50: "#fefdfb",
          100: "#fcfaf6",
          200: "#f8f5ed",
          300: "#f2ede1",
          400: "#e8e0ce",
          500: "#d4c9b0",
        },
        // Ink colors for text
        ink: {
          50: "#f6f6f6",
          100: "#e7e7e7",
          200: "#d1d1d1",
          300: "#b0b0b0",
          400: "#888888",
          500: "#6d6d6d",
          600: "#5d5d5d",
          700: "#4f4f4f",
          800: "#3d3d3d",
          900: "#1a1a1a",
          950: "#0d0d0d",
        },
        // Accent colors
        terminal: {
          green: "#22c55e",
          blue: "#3b82f6",
          purple: "#8b5cf6",
          amber: "#f59e0b",
        },
        // Status colors
        status: {
          success: "#16a34a",
          pending: "#2563eb",
          waiting: "#9ca3af",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "Menlo", "monospace"],
        display: ["var(--font-instrument)", "Georgia", "serif"],
      },
      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "0.875rem" }],
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease-out forwards",
        "slide-up": "slideUp 0.4s ease-out forwards",
        "slide-in-right": "slideInRight 0.3s ease-out forwards",
        "pulse-subtle": "pulseSubtle 2s ease-in-out infinite",
        expand: "expand 0.3s ease-out forwards",
        typing: "typing 1.5s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideInRight: {
          "0%": { opacity: "0", transform: "translateX(10px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        pulseSubtle: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
        expand: {
          "0%": { opacity: "0", height: "0" },
          "100%": { opacity: "1", height: "var(--expanded-height)" },
        },
        typing: {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "1" },
        },
      },
      boxShadow: {
        soft: "0 2px 8px -2px rgba(0, 0, 0, 0.08), 0 4px 16px -4px rgba(0, 0, 0, 0.04)",
        elevated: "0 4px 12px -2px rgba(0, 0, 0, 0.12), 0 8px 24px -4px rgba(0, 0, 0, 0.08)",
        panel: "0 1px 3px rgba(0, 0, 0, 0.04), 0 6px 16px rgba(0, 0, 0, 0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
