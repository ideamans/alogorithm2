import test from 'ava'

import { createInlineCustomSvgImage, createInlineSvgImage } from './inline.js'
import { createRectSvgImage } from './rect.js'
import { createTestDependency, svgDigest } from './spec-helper.js'

const dep = createTestDependency()

test('inline logo keeps the requested width and the seed', async (t) => {
  const image = await createInlineSvgImage({ seed: 'abc', width: 512, colorTheme: 'light' }, dep)
  t.is(image.width, 512)
  t.true(image.height > 0 && image.height < 512)
  t.is(image.seed, 'abc')
})

test('inline-custom logo keeps the requested height', async (t) => {
  const image = await createInlineCustomSvgImage({ seed: 'abc', text: 'hello', height: 64, colorTheme: 'dark' }, dep)
  t.is(image.height, 64)
  t.true(image.width > 64)
  t.is(image.seed, 'abc')
})

test('rect logo keeps the requested size', async (t) => {
  const image = await createRectSvgImage({ seed: 'abc', width: 400, height: 300, colorTheme: 'auto' }, dep)
  t.is(image.width, 400)
  t.is(image.height, 300)
  t.is(image.seed, 'abc')
})

// Text rendering and composition must stay stable as well.
// If this fails on purpose, update with: npx ava --update-snapshots
test('layouts stay stable across versions', async (t) => {
  t.snapshot(svgDigest(await createInlineSvgImage({ seed: 'abc', width: 512, colorTheme: 'light' }, dep)), 'inline')
  t.snapshot(
    svgDigest(await createRectSvgImage({ seed: 'abc', width: 512, height: 512, colorTheme: 'auto' }, dep)),
    'rect',
  )
})
