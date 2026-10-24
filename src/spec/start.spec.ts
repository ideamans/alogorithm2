import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { createServer as createNetServer } from 'node:net'

import test from 'ava'

import { Dependency } from '../dependency.js'

import { pngSize, pngTextChunks } from './helpers.js'

async function freePort(): Promise<number> {
  const srv = createNetServer()
  srv.listen(0, '127.0.0.1')
  await once(srv, 'listening')
  const address = srv.address()
  srv.close()
  if (!address || typeof address === 'string') throw new Error('No port')
  return address.port
}

test('Dependency reads defaults and environment variables', (t) => {
  const saved = { ...process.env }
  try {
    process.env.PORT = '4567'
    process.env.DEFAULT_SEED = 'env-seed'
    process.env.LOG_LEVEL = 'silent'
    const dep = new Dependency()
    t.is(dep.defaults.serverPort, 4567)
    t.is(dep.defaults.seed, 'env-seed')
    t.is(dep.logoTextDefaults.font, 'IBMPlexSans-SemiBold.otf')
    t.is(dep.iconDefaults.size, 64)
    t.is(dep.inlineDefaults.width, 512)
  } finally {
    process.env = saved
  }
})

// Starts the real entry point (build/start.js) the same way `yarn start` / Docker does,
// including the pino + pino-pretty logger, and talks to it over HTTP.
test('build/start.js serves logos over HTTP and shuts down on SIGTERM', async (t) => {
  const port = await freePort()
  const child = spawn(process.execPath, ['build/start.js'], {
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DEFAULT_SEED: 'from-env' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let output = ''
  child.stdout.on('data', (d) => (output += d))
  child.stderr.on('data', (d) => (output += d))
  t.teardown(() => {
    if (child.exitCode === null) child.kill('SIGKILL')
  })

  const base = `http://127.0.0.1:${port}`
  const deadline = Date.now() + 20000
  for (;;) {
    try {
      await fetch(`${base}/v2/icon.svg`)
      break
    } catch (err) {
      if (Date.now() > deadline) throw new Error(`Server did not start: ${output}`, { cause: err })
      await new Promise((r) => setTimeout(r, 200))
    }
  }

  const svg = await fetch(`${base}/v2/icon.svg`)
  t.is(svg.status, 200)
  t.is(svg.headers.get('content-type'), 'image/svg+xml')
  t.regex(await svg.text(), /<title>from-env<\/title>/, 'DEFAULT_SEED is applied')

  const png = await fetch(`${base}/v2/rect.png?width=120&seed=http`)
  t.is(png.status, 200)
  t.is(png.headers.get('content-type'), 'image/png')
  const body = Buffer.from(await png.arrayBuffer())
  t.deepEqual(pngSize(body), { width: 120, height: 120 })
  t.is(pngTextChunks(body).Seed, 'http')

  child.kill('SIGTERM')
  const [code] = await once(child, 'exit')
  t.is(code, 0, output)
  t.regex(output, /Server listening on 127\.0\.0\.1:/)
  t.regex(output, /Server shut down/)
})
