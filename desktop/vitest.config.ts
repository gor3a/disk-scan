import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Dedicated config so the electron plugin doesn't activate during unit tests.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setupTests.ts'],
  },
})
