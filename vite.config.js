import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base = nazwa repozytorium, bo GitHub Pages serwuje stronę pod https://cgrzegorz.github.io/architekci/
export default defineConfig({
  base: '/architekci/',
  plugins: [react()],
})
