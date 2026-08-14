/**
 * Dev-only endpoint backing `dev/capture.html`.
 *
 * `POST /__capture` writes one JPEG into public/targets/. This exists so you can
 * shoot target photos with the phone that will actually run the AR, without
 * transferring files by hand.
 *
 * It writes to disk from an unauthenticated http endpoint, so the constraints
 * below are load-bearing, not decoration:
 *
 *   - only mounted for `vite dev`, never for build or preview
 *   - the output directory is fixed; the client cannot influence it
 *   - the client supplies an id and an angle number, never a path. The id is
 *     hard-restricted to [a-z0-9-] and the angle to a small integer, so the
 *     final name cannot contain a separator, a dot segment, or an extension
 *   - the body must be a JPEG (checked by magic bytes, not by a header) and
 *     under a size cap
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { Connect, Plugin } from 'vite'

const maxBytes = 6 * 1024 * 1024
const maxAngles = 12
const outputSubdir = 'public/targets'

/** JPEG SOI marker; a real check rather than trusting content-type */
const isJpeg = (buffer: Buffer) =>
  buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff

const readBody = (request: Connect.IncomingMessage) =>
  new Promise<Buffer>((resolvePromise, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    request.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > maxBytes) {
        reject(new Error(`payload over ${maxBytes} bytes`))
        request.destroy()
        return
      }
      chunks.push(chunk)
    })
    request.on('end', () => resolvePromise(Buffer.concat(chunks)))
    request.on('error', reject)
  })

/**
 * Rejects rather than sanitises. Silently rewriting a bad id would let a
 * caller aim at a name they did not ask for; a 400 is honest.
 */
const validateId = (value: string | null): string | null => {
  if (!value) return null
  if (!/^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$/.test(value)) return null
  return value
}

const validateAngle = (value: string | null): number | null => {
  if (!value) return null
  const angle = Number(value)
  if (!Number.isInteger(angle) || angle < 1 || angle > maxAngles) return null
  return angle
}

export const captureEndpoint = (projectRoot: string): Plugin => ({
  name: 'target-capture-endpoint',
  // apply is belt to configureServer's braces: this must never reach a build
  apply: 'serve',
  configureServer(server) {
    const outputDir = resolve(projectRoot, outputSubdir)

    server.middlewares.use('/__capture', (request, response, next) => {
      if (request.method !== 'POST') return next()

      const send = (status: number, body: unknown) => {
        response.statusCode = status
        response.setHeader('content-type', 'application/json')
        response.end(JSON.stringify(body))
      }

      void (async () => {
        try {
          const url = new URL(request.url ?? '', 'http://localhost')
          const id = validateId(url.searchParams.get('id'))
          const angle = validateAngle(url.searchParams.get('angle'))

          if (!id) return send(400, { error: 'id must match [a-z0-9-], 1-40 chars' })
          if (!angle) return send(400, { error: `angle must be an integer 1-${maxAngles}` })

          const body = await readBody(request)
          if (!isJpeg(body)) return send(400, { error: 'body must be a jpeg' })

          // id and angle are both validated above, so this name is a plain
          // slug with no separators and cannot escape outputDir
          const file = `${id}-${String(angle).padStart(2, '0')}.jpg`
          await mkdir(outputDir, { recursive: true })
          await writeFile(resolve(outputDir, file), body)

          server.config.logger.info(
            `  captured ${outputSubdir}/${file} (${(body.length / 1024).toFixed(0)} kB)`
          )
          send(200, { file, bytes: body.length })
        } catch (error) {
          send(400, { error: error instanceof Error ? error.message : 'capture failed' })
        }
      })()
    })
  }
})
