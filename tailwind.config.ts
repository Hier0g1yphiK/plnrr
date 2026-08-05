import type { Config } from "tailwindcss";

/**
 * Tailwind configuration reference for plnrr.
 *
 * NOTE: This project uses Tailwind CSS v4 which primarily configures
 * theme tokens via @theme in globals.css. This file serves as a
 * reference for the design system and is used by tooling (IDE plugins, etc).
 *
 * The actual runtime configuration is in src/app/globals.css.
 */
const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        lavender: {
          50: "#f5f3ff",
          100: "#ede9fe",
          200: "#ddd6fe",
          300: "#c4b5fd",
          400: "#a78bfa",
          500: "#8b5cf6",
          600: "#7c3aed",
          700: "#6d28d9",
          800: "#5b21b6",
          900: "#4c1d95",
          950: "#2e1065",
        },
        mint: {
          50: "#ecfdf5",
          100: "#d1fae5",
          200: "#a7f3d0",
          300: "#6ee7b7",
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
          700: "#047857",
          800: "#065f46",
          900: "#064e3b",
          950: "#022c22",
        },
        amber: {
          50: "#fffbeb",
          100: "#fef3c7",
          200: "#fde68a",
          300: "#fcd34d",
          400: "#fbbf24",
          500: "#f59e0b",
          600: "#d97706",
          700: "#b45309",
          800: "#92400e",
          900: "#78350f",
          950: "#451a03",
        },
        pink: {
          50: "#fdf2f8",
          100: "#fce7f3",
          200: "#fbcfe8",
          300: "#f9a8d4",
          400: "#f472b6",
          500: "#ec4899",
          600: "#db2777",
          700: "#be185d",
          800: "#9d174d",
          900: "#831843",
          950: "#500724",
        },
        electric: {
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          800: "#1e40af",
          900: "#1e3a8a",
          950: "#172554",
        },
        cyan: {
          50: "#ecfeff",
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
        // Semantic theme colors (resolved via CSS custom properties)
        theme: {
          bg: "var(--theme-bg)",
          surface: "var(--theme-surface)",
          "surface-alt": "var(--theme-surface-alt)",
          border: "var(--theme-border)",
          "border-subtle": "var(--theme-border-subtle)",
          text: "var(--theme-text)",
          "text-muted": "var(--theme-text-muted)",
          "text-faint": "var(--theme-text-faint)",
          accent: "var(--theme-accent)",
          "accent-hover": "var(--theme-accent-hover)",
          "accent-text": "var(--theme-accent-text)",
          "accent-subtle": "var(--theme-accent-subtle)",
          brand: "var(--theme-brand)",
        },
      },
      fontFamily: {
        display: ["var(--theme-font-display)"],
        body: ["var(--theme-font-body)"],
      },
    },
  },
  plugins: [],
};

export default config;
