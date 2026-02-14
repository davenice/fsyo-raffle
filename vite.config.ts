import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import mkcert from 'vite-plugin-mkcert'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), mkcert()],
  base: '/fsyo-raffle/', // GitHub Pages path
  server: {
    host: true, // Expose to network for phone access
  },
})
