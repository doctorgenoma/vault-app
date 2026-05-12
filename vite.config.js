import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  // GitHub Pages sirve desde /nombre-del-repo/
  // Cambia 'vault-app' por el nombre EXACTO de tu repositorio en GitHub
  base: '/vault-app/',

  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  server: {
    port: 5173,
    host: true,
  }
})
