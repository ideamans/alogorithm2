import { createRequire } from 'node:module'

import test from 'ava'
import Sharp from 'sharp'

import { createServer } from '../server.js'

import { comparePixels, pngSize, pngTextChunks, readOrWriteGolden, testDependency } from './helpers.js'

const require = createRequire(import.meta.url)
const { version } = require('../../package.json') as { version: string }

const server = createServer(testDependency())
test.after.always(() => server.close())

async function get(url: string) {
  return server.inject({ method: 'GET', url })
}

const endpoints: { url: string; width: number; height?: number }[] = [
  { url: '/v2/inline', width: 512 },
  { url: '/v2/inline-custom', width: 0, height: 128 },
  { url: '/v2/rect', width: 512, height: 512 },
  { url: '/v2/icon', width: 64, height: 64 },
]

for (const { url, width, height } of endpoints) {
  test(`GET ${url}.svg returns SVG with defaults`, async (t) => {
    const res = await get(`${url}.svg`)
    t.is(res.statusCode, 200)
    t.is(res.headers['content-type'], 'image/svg+xml')
    t.is(res.headers['x-app-version'], version)
    t.regex(res.body, /^<svg /)
    t.regex(res.body, /<title>alogorithm2<\/title>/)
    if (width) t.regex(res.body, new RegExp(`^<svg [^>]*width="${width}"`))
    if (height) t.regex(res.body, new RegExp(`^<svg [^>]*height="${height}"`))
  })

  test(`GET ${url}.png returns PNG with Seed tEXt chunk`, async (t) => {
    const res = await get(`${url}.png?seed=png-seed`)
    t.is(res.statusCode, 200)
    t.is(res.headers['content-type'], 'image/png')
    t.is(res.headers['x-app-version'], version)
    const png = res.rawPayload
    const size = pngSize(png)
    if (width) t.is(size.width, width)
    if (height) t.is(size.height, height)
    t.is(pngTextChunks(png).Seed, 'png-seed')
    const meta = await Sharp(png).metadata()
    t.is(meta.format, 'png')
    t.is(meta.channels, 4)
    t.is(meta.width, size.width)
    t.is(meta.height, size.height)
  })
}

test('query parameters change seed and size', async (t) => {
  const a = await get('/v2/icon.svg?seed=a&width=100&height=50')
  const b = await get('/v2/icon.svg?seed=b&width=100&height=50')
  t.regex(a.body, /^<svg [^>]*width="100" height="50"/)
  t.regex(a.body, /<title>a<\/title>/)
  t.not(a.body, b.body)
  t.is((await get('/v2/icon.svg?seed=a&width=100&height=50')).body, a.body, 'same query is deterministic')
})

test('rect height defaults to width', async (t) => {
  const res = await get('/v2/rect.svg?width=200')
  t.regex(res.body, /^<svg [^>]*width="200" height="200"/)
})

test('icon circle=1 uses a circular clip path', async (t) => {
  const res = await get('/v2/icon.svg?circle=1&width=80')
  t.regex(res.body, /<clipPath id="clip"><circle cx="40" cy="40" r="40"/)
  const plain = await get('/v2/icon.svg?circle=0&width=80')
  t.notRegex(plain.body, /<circle /)
})

test('colorTheme parameter', async (t) => {
  t.regex((await get('/v2/inline.svg?colorTheme=dark')).body, /fill="#ddd"/)
  t.regex((await get('/v2/inline.svg?colorTheme=light')).body, /fill="#555"/)
  t.regex((await get('/v2/inline.svg')).body, /prefers-color-scheme: dark/)
})

test('inline-custom text parameter', async (t) => {
  const short = await get('/v2/inline-custom.svg?text=a&height=100')
  const long = await get('/v2/inline-custom.svg?text=abcdefghijk&height=100')
  const widthOf = (body: string) => Number(/^<svg [^>]*width="(\d+)"/.exec(body)![1])
  t.true(widthOf(long.body) > widthOf(short.body))
})

test('PNG seed with non-latin1 characters still produces a valid PNG', async (t) => {
  const res = await get(`/v2/icon.png?seed=${encodeURIComponent('日本語')}`)
  t.is(res.statusCode, 200)
  const meta = await Sharp(res.rawPayload).metadata()
  t.is(meta.format, 'png')
})

test('unknown routes return 404 JSON', async (t) => {
  const res = await get('/v2/unknown.svg')
  t.is(res.statusCode, 404)
  t.regex(res.headers['content-type'] as string, /application\/json/)
  t.is(res.headers['x-app-version'], version)
})

test('non-GET methods are not routed', async (t) => {
  const res = await server.inject({ method: 'POST', url: '/v2/icon.svg' })
  t.is(res.statusCode, 404)
})

test('formats other than png are served as SVG (current behavior)', async (t) => {
  const res = await get('/v2/icon.jpg')
  t.is(res.statusCode, 200)
  t.is(res.headers['content-type'], 'image/svg+xml')
})

test('rendering errors are reported as 500 JSON (current behavior)', async (t) => {
  // A width of 0 cannot be rasterized by sharp
  const res = await get('/v2/icon.png?width=0&height=0')
  t.is(res.statusCode, 500)
  t.regex(res.headers['content-type'] as string, /application\/json/)
})

// Rasterization goes through sharp/libvips/librsvg and may change slightly between versions,
// so PNGs are compared pixel-wise with a tolerance instead of byte-for-byte.
const pngGoldenCases = [
  ['icon-64.png', '/v2/icon.png'],
  ['icon-circle-256.png', '/v2/icon.png?seed=circle&width=256&circle=1'],
  ['inline-light-512.png', '/v2/inline.png?colorTheme=light'],
  ['rect-dark-300.png', '/v2/rect.png?seed=rect&width=300&colorTheme=dark'],
] as const

for (const [name, url] of pngGoldenCases) {
  test(`golden PNG: ${name}`, async (t) => {
    const res = await get(url)
    t.is(res.statusCode, 200)
    const golden = readOrWriteGolden(name, res.rawPayload)
    const diff = await comparePixels(res.rawPayload, golden)
    t.log(
      `${name}: meanAbsDiff=${diff.meanAbsDiff.toFixed(4)} maxAbsDiff=${diff.maxAbsDiff} differing=${(diff.differingRatio * 100).toFixed(3)}%`,
    )
    t.true(diff.meanAbsDiff < 1.0, `meanAbsDiff=${diff.meanAbsDiff}`)
    t.true(diff.differingRatio < 0.01, `differingRatio=${diff.differingRatio}`)
  })
}
