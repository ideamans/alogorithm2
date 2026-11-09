import test from 'ava'

import { createIconSvgImage } from './icon.js'
import { createMarkSvgImage } from './mark.js'
import { createTestDependency, findNodes, svgDigest } from './spec-helper.js'

const dep = createTestDependency()

function clipShapeName(svgNode: Parameters<typeof findNodes>[0]): string {
  return findNodes(svgNode, 'clipPath')[0].children[0].name
}

test('without options the icon is the plain mark', async (t) => {
  const icon = await createIconSvgImage({ seed: 'abc', width: 64, height: 64 }, dep)
  const mark = await createMarkSvgImage({ seed: 'abc', width: 64, height: 64 }, dep)
  t.is(svgDigest(icon), svgDigest(mark))
  t.is(clipShapeName(icon.svgNode), 'path')
})

test('circle clips with a circle', async (t) => {
  const icon = await createIconSvgImage({ seed: 'abc', width: 64, height: 64, circle: true }, dep)
  t.is(clipShapeName(icon.svgNode), 'circle')
})

test('square clips with a rect and applies radius', async (t) => {
  const icon = await createIconSvgImage({ seed: 'abc', width: 64, height: 64, square: true, radius: 0.25 }, dep)
  const rect = findNodes(icon.svgNode, 'clipPath')[0].children[0]
  t.is(rect.name, 'rect')
  t.is(rect.attributes.rx, '16')
})

test('circle takes precedence over square', async (t) => {
  const icon = await createIconSvgImage({ seed: 'abc', width: 64, height: 64, circle: true, square: true }, dep)
  t.is(clipShapeName(icon.svgNode), 'circle')
})

test('clipping keeps the same pattern', async (t) => {
  const plain = await createIconSvgImage({ seed: 'abc', width: 64, height: 64 }, dep)
  const square = await createIconSvgImage({ seed: 'abc', width: 64, height: 64, square: true }, dep)
  t.deepEqual(findNodes(plain.svgNode, 'g'), findNodes(square.svgNode, 'g'))
})
