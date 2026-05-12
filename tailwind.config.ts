import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        "bg-elev": "var(--bg-elev)",
        "bg-sunk": "var(--bg-sunk)",
        ink: "var(--ink)",
        "ink-2": "var(--ink-2)",
        "ink-3": "var(--ink-3)",
        "ink-mute": "var(--ink-mute)",
        line: "var(--line)",
        "line-2": "var(--line-2)",
        accent: "var(--accent)",
        "accent-2": "var(--accent-2)",
        "accent-tint": "var(--accent-tint)",
      },
      fontFamily: {
        serif: "var(--serif)",
        sans: "var(--sans)",
        mono: "var(--mono)",
        reader: "var(--reader-font, var(--serif))",
      },
      borderRadius: {
        sm: "var(--r-sm)",
        md: "var(--r-md)",
        lg: "var(--r-lg)",
        xl: "var(--r-xl)",
      },
      boxShadow: {
        paper: "var(--paper-shadow)",
      },
      maxWidth: {
        reader: "var(--reader-measure)",
      },
      animation: {
        "fade-up": "fadeUp 480ms cubic-bezier(.2,.8,.2,1) both",
        "fade-in": "fadeIn 360ms ease both",
        pulse: "pulse 1s ease-in-out infinite",
      },
      keyframes: {
        fadeUp: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "none" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        pulse: {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: ".35", transform: "scale(.7)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
