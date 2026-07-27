import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/hooks/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#2563eb",
          dark: "#1d4ed8",
          light: "#3b82f6",
        },
        sidebar: {
          DEFAULT: "#0f172a",
          hover: "#1e293b",
          active: "#1e40af",
        },
        success: "#10b981",
        warning: "#f59e0b",
        danger: "#ef4444",
        info: "#06b6d4",
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};

export default config;
