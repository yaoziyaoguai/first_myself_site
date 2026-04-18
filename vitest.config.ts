import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './vitest.setup.ts',
  },
  resolve: {
    alias: {
      // Order matters: vite alias is first-match-wins (declaration order).
      // '@/app' must be listed BEFORE '@', otherwise '@' would intercept
      // imports like '@/app/foo' and resolve them to './src/app/foo'.
      '@/app': path.resolve(__dirname, './app'),
      '@payload-config': path.resolve(__dirname, './payload.config.ts'),
      '@': path.resolve(__dirname, './src'),
    },
  },
})
