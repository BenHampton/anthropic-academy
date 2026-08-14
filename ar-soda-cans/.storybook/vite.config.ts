import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// storybook uses this instead of the root vite.config.ts so the mkcert plugin
// never runs for the storybook dev server
export default defineConfig({
  plugins: [react()]
})
