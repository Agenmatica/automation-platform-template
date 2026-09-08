import react from '@vitejs/plugin-react'
// `vitest/config` re-exports Vite's defineConfig with the `test` key typed,
// so build and tests share this one file instead of two configs to keep in sync.
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3100,
  },
  preview: {
    host: '0.0.0.0',
    port: 3100,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    // Sin "inline", vitest externaliza estos paquetes (los carga con el
    // resolutor ESM nativo de Node en vez de con el de Vite): @mui/material
    // reexporta subpaths sin extensión que Node no soporta como import de
    // directorio, y react-router terminaba cargado dos veces (una copia
    // externa, otra vía Vite en App.tsx) con contextos de React distintos
    // ("useLocation() may be used only in the context of a <Router>").
    // Ver App.test.tsx.
    server: {
      deps: {
        inline: [/@refinedev\//, /@mui\//, /react-router/],
      },
    },
  },
})
