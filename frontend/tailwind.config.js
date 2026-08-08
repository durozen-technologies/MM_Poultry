/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.tsx", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        brand: {
          ink: "#1a2e1a",
          leaf: "#2f6b3a",
          sand: "#f3efe6",
          clay: "#c45c26",
        },
      },
    },
  },
  plugins: [],
};
