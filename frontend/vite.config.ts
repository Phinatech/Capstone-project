import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    /**
     * Proxy the API onto the same origin as the UI.
     *
     * Auth now runs on an httpOnly session cookie, and a cookie set for
     * `localhost:5173` will not be sent to `localhost:3001` — different port,
     * different origin. Routing `/api` and `/auth` through Vite keeps the
     * browser seeing one origin, so the cookie flows without needing
     * `SameSite=None; Secure` (which requires HTTPS and would break plain-http
     * development).
     *
     * Set VITE_API_URL to point somewhere else entirely; the proxy is only the
     * default.
     */
    proxy: {
      '/api': 'http://localhost:3001',
      '/auth': 'http://localhost:3001'
    }
  }
})
