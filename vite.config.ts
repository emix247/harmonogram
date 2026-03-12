import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  clearScreen: false,       // chyby zůstanou viditelné v terminálu
  server: {
    port: 5173,
    strictPort: true,       // vždy port 5173, ne náhodný fallback
    hmr: {
      overlay: false,       // HMR chybový overlay neblokuje UI – ErrorBoundary to zachytí
    },
  },
})
