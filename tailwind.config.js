/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // One neutral ramp plus semantic roles, so a status colour is chosen by
        // meaning rather than by picking a shade at each call site.
        brand: {
          50: "#eef4ff",
          100: "#d9e5ff",
          200: "#bcd0ff",
          300: "#8eb0ff",
          400: "#5885fc",
          500: "#3461f0",
          600: "#2145dd",
          700: "#1c37b3",
          800: "#1c318e",
          900: "#1c2d70",
        },
        // Saga states. Each maps to one step colour in the order stepper.
        saga: {
          pending: "#a855f7",
          reserved: "#3461f0",
          paid: "#0ea5e9",
          confirmed: "#10b981",
          shipped: "#6366f1",
          delivered: "#059669",
          failed: "#ef4444",
          cancelled: "#71717a",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        // Used on the in-flight step of the order stepper, so the page visibly
        // signals "something is happening" while the saga runs.
        "pulse-ring": {
          "0%": { boxShadow: "0 0 0 0 rgba(52, 97, 240, 0.45)" },
          "70%": { boxShadow: "0 0 0 10px rgba(52, 97, 240, 0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(52, 97, 240, 0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.2s ease-out",
        "pulse-ring": "pulse-ring 1.8s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        shimmer: "shimmer 1.5s infinite",
      },
    },
  },
  plugins: [],
};
