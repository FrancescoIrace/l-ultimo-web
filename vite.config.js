import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    middlewares: [
      (req, res, next) => {
        // Se la richiesta non è un file statico e non è .json/.js/.css etc
        // allora fai il fallback a index.html per il routing SPA
        if (req.url === '/' || (!req.url.includes('.') && !req.url.startsWith('/api'))) {
          req.url = '/index.html'
        }
        next()
      }
    ]
  }
})
