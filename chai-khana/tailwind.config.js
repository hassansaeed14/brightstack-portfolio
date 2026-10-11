// Tailwind settings for the Chai Khana page only (compiled at build time by vite.config.js).
// Pinned to Tailwind 3.4.17, the version the page used from the Play CDN, so the output matches.
/** @type {import('tailwindcss').Config} */
export default {
  // Scans the page's markup and its inline scripts (which add classes such as `hidden` and the menu-tab classes).
  content: { relative: true, files: ['./index.html'] },
  theme: {
    extend: {
      colors: {
        primary: '#2B1B12',   // Dark warm brown
        cream: '#F5E6D3',     // Cream text/accent
        gold: '#E3A33B',      // Saffron/gold
        goldDark: '#B87D22',
        darker: '#1E120C'     // Even darker brown for deep contrast
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'serif'],
        sans: ['Poppins', 'sans-serif']
      }
    }
  }
}
