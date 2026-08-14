import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import mkcert from 'vite-plugin-mkcert'
import { captureEndpoint } from './scripts/captureEndpoint'

/**
 * mind-ar@1.2.5 was built against three <r152 and still imports `sRGBEncoding`,
 * which three removed in r152. The import is a link-time error on modern three
 * even though the only use is `renderer.outputEncoding = sRGBEncoding` — a
 * no-op now that `outputColorSpace` defaults to srgb.
 *
 * Rather than pinning three to a 2023 release, drop the dead import and
 * replace the binding with its old numeric value.
 */
const mindArThreeCompat = (): Plugin => ({
  name: 'mind-ar-three-compat',
  enforce: 'pre',
  transform(code, id) {
    if (!id.includes('mind-ar/dist/mindar-image-three')) return null

    const match = code.match(/sRGBEncoding\s+as\s+(\w+)\s*,?/)
    // upstream fixed it, or the bundle changed shape — either way, leave it alone
    if (!match) return null

    const alias = match[1]
    // `var` rather than `const` so hoisting keeps it valid wherever it is used
    return { code: `var ${alias} = 3001;\n${code.replace(match[0], '')}`, map: null }
  }
})

/**
 * mkcert issues a locally-trusted cert so the dev server is a secure context.
 * getUserMedia refuses to run over plain http on a LAN ip, so this is what
 * makes testing on a real phone possible.
 *
 * Its first run shells out to `mkcert -install`, which needs sudo to add the CA
 * to the system keychain. Set NO_HTTPS=1 to skip it (localhost is a secure
 * context on its own, so plain http is fine for desktop-only testing).
 */
const wantsHttps = process.env['NO_HTTPS'] !== '1'

const projectRoot = dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ command, isPreview }) => {
  const isDevServer = command === 'serve' && !isPreview

  return {
  plugins: [
    mindArThreeCompat(),
    react(),
    // dev server only: preview and build have no reason to pay the cert cost
    ...(isDevServer && wantsHttps ? [mkcert()] : []),
    // writes files to public/targets — dev server only, never preview or build
    ...(isDevServer ? [captureEndpoint(projectRoot)] : [])
  ],
  server: {
    // host: true binds the lan ip so a phone on the same wifi can reach it.
    // 5180 rather than vite's default 5173, which is already spoken for.
    host: true,
    port: 5180
  },
  preview: {
    host: true,
    port: 4173
  },
  optimizeDeps: {
    // pre-bundling mind-ar would bypass the compat transform above
    exclude: ['mind-ar'],
    include: ['three']
  }
  }
})
