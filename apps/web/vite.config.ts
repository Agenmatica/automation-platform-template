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
  },
})
