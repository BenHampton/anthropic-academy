import { defineConfig } from 'vitest/config'

// deliberately separate from vite.config.ts so the mkcert plugin never runs
// during a test run
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx']
  }
})
