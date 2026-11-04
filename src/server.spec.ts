import test from 'ava'
import Svgson from 'svgson'

import { formatYmd } from './seed.js'
import { createServer } from './server.js'
import { createTestDependency, findNodes } from './spec-helper.js'

const dep = createTestDependency()
const server = createServer(dep)
const TODAY = encodeURIComponent('{today}')

test.after.always(async () => {
  await server.close()
})

async function get(url: string) {
  return server.inject({ method: 'GET', url })
}

async function svgTitle(body: string): Promise<string | undefined> {
  const svg = await Svgson.parse(body)
  return findNodes(svg, 'title')[0]?.children[0]?.value
}

// Read a PNG tEXt chunk value by keyword
function pngText(png: Buffer, keyword: string): string | undefined {
  let offset = 8
  while (offset < png.length) {
    const length = png.readUInt32BE(offset)
    const type = png.toString('ascii', offset + 4, offset + 8)
    if (type === 'tEXt') {
      const data = png.subarray(offset + 8, offset + 8 + length)
      const nul = data.indexOf(0)
      if (data.toString('latin1', 0, nul) === keyword) return data.toString('latin1', nul + 1)
    }
    offset += 12 + length
  }
  return undefined
}

for (const path of ['/v2/inline', '/v2/inline-custom', '/v2/rect', '/v2/icon']) {
  test(`${path}.svg returns an SVG`, async (t) => {
    const res = await get(`${path}.svg?seed=abc`)
    t.is(res.statusCode, 200)
    t.is(res.headers['content-type'], 'image/svg+xml')
    t.true(res.body.startsWith('<svg'))
    t.is(await svgTitle(res.body), 'abc')
  })

  test(`${path}.png returns a PNG with the seed`, async (t) => {
    const res = await get(`${path}.png?seed=abc`)
    t.is(res.statusCode, 200)
    t.is(res.headers['content-type'], 'image/png')
    const png = res.rawPayload
    t.is(png.toString('ascii', 1, 4), 'PNG')
    t.is(pngText(png, 'Seed'), 'abc')
  })
}

test('X-App-Version is sent', async (t) => {
  const res = await get('/v2/icon.svg')
  t.regex(String(res.headers['x-app-version']), /^\d+\.\d+\.\d+/)
})

test('seed defaults to DEFAULT_SEED', async (t) => {
  const res = await get('/v2/icon.svg')
  t.is(await svgTitle(res.body), dep.defaults.seed)
})

test('{today} is expanded in the default time zone', async (t) => {
  const res = await get(`/v2/icon.svg?seed=logo-${TODAY}`)
  t.is(res.statusCode, 200)
  t.is(await svgTitle(res.body), `logo-${formatYmd(new Date(), dep.defaults.timeZone)}`)
})

test('{today} follows the tz parameter', async (t) => {
  // UTC+14 and UTC-11: their dates almost always differ, so this proves tz is used
  for (const tz of ['Pacific/Kiritimati', 'Pacific/Pago_Pago']) {
    const res = await get(`/v2/icon.svg?seed=${TODAY}&tz=${encodeURIComponent(tz)}`)
    t.is(await svgTitle(res.body), formatYmd(new Date(), tz), tz)
  }
})

test('the expanded seed goes into the PNG tEXt chunk', async (t) => {
  const res = await get(`/v2/icon.png?seed=${TODAY}&tz=UTC`)
  t.is(pngText(res.rawPayload, 'Seed'), formatYmd(new Date(), 'UTC'))
})

test('the expanded seed draws the same logo as the literal seed', async (t) => {
  const today = formatYmd(new Date(), 'UTC')
  const a = await get(`/v2/icon.svg?seed=${TODAY}&tz=UTC`)
  const b = await get(`/v2/icon.svg?seed=${today}`)
  t.is(a.body, b.body)
})

test('an invalid tz returns 400', async (t) => {
  const res = await get(`/v2/icon.svg?seed=${TODAY}&tz=Nope%2FZone`)
  t.is(res.statusCode, 400)
  t.deepEqual(res.json(), { error: 'Invalid time zone: Nope/Zone' })
})

test('icon square and radius are applied', async (t) => {
  const res = await get('/v2/icon.svg?seed=abc&width=100&square=1&radius=0.2')
  const rect = findNodes(await Svgson.parse(res.body), 'clipPath')[0].children[0]
  t.is(rect.name, 'rect')
  t.is(rect.attributes.rx, '20')
})

test('icon circle wins over square', async (t) => {
  const res = await get('/v2/icon.svg?seed=abc&circle=1&square=1')
  t.is(findNodes(await Svgson.parse(res.body), 'clipPath')[0].children[0].name, 'circle')
})

test('icon radius that is not a number is treated as 0', async (t) => {
  const res = await get('/v2/icon.svg?seed=abc&square=1&radius=abc')
  t.is(findNodes(await Svgson.parse(res.body), 'clipPath')[0].children[0].attributes.rx, '0')
})
