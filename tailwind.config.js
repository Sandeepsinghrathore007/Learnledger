/** @type {import('tailwindcss').Config} */
export default {
  // Only scan src files for used classes
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'DM Sans'", "'Noto Sans Devanagari'", 'sans-serif'],
        mono: ["'Fira Code'", "'Courier New'", 'monospace'],
      },
      colors: {
        // StudyOS design system colours
        bg:       '#070510',
        surface:  '#0d0b1a',
        surface2: '#110f1f',
        accent:   '#7c3aed',
        accent2:  '#6d28d9',
        text1:    '#ede6ff',
        text2:    '#9d8ec4',
        text3:    '#5a5175',
      },
    },
  },
  plugins: [],
}
