import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const root = import.meta.dirname

// Every top-level page plus project folders that have their own index.html.
const pages = [
  ...readdirSync(root).filter(f => f.endsWith('.html')),
  'chai-khana/index.html',
]

export default defineConfig({
  // Relative URLs so the build works under /brightstack-portfolio/ on GitHub Pages.
  base: './',
  plugins: [
    react(),
    {
      // sitemap.xml isn't referenced by any page, so Vite wouldn't emit it on its own.
      name: 'copy-sitemap',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: readFileSync(resolve(root, 'sitemap.xml')) })
      },
    },
  ],
  input: Object.fromEntries(pages.map(p => [p.replace(/\.html$/, ''), resolve(root, p)])),
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            // Give three.js its own chunk. Without this, the bundler's small runtime helpers
            // land inside the three.js chunk and every page that needs them (sign-in, admin,
            // client area) downloads three.js too.
            { name: 'three', test: /node_modules[\\/]three[\\/]/ },
          ],
        },
      },
    },
  },
})
