/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'node',
    globals: true,
    exclude: ['src/__tests__/integration/**', 'src/__tests__/e2e/**', 'node_modules/**'],
  },
})
