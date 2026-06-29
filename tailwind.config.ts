import type { Config } from "tailwindcss";

// NOTE: preflight is disabled so Tailwind's CSS reset does NOT alter the
// hand-built design. The exact original styles live in app/globals.css and
// remain pixel-identical. Tailwind utilities are still available for new work.
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}"
  ],
  corePlugins: {
    preflight: false
  },
  theme: { extend: {} },
  plugins: []
};
export default config;
