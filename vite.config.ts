import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/rental-desk-mvp/',
  plugins: [react()],
  test: { environment: 'node', exclude: ['node_modules/**', 'e2e/**'], testTimeout: 15000 },
})
