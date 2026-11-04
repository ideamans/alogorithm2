import test from 'ava'

import { createMarkSvgImage } from './mark.js'
import { createTestDependency, findNodes, svgDigest } from './spec-helper.js'

const dep = createTestDependency()

test('the same seed always produces the same mark', async (t) => {
  const a = await createMarkSvgImage({ seed: 'abc', width: 128, height: 128 }, dep)
  const b = await createMarkSvgImage({ seed: 'abc', width: 128, height: 128 }, dep)
  t.is(svgDigest(a), svgDigest(b))
})

test('different seeds produce different marks', async (t) => {
  const a = await createMarkSvgImage({ seed: 'abc', width: 128, height: 128 }, dep)
  const b = await createMarkSvgImage({ seed: 'abd', width: 128, height: 128 }, dep)
  t.not(svgDigest(a), svgDigest(b))
})

test('the mark has the requested size, the seed as title and a blob clip path', async (t) => {
  const mark = await createMarkSvgImage({ seed: 'abc', width: 100.4, height: 64 }, dep)
  t.is(mark.width, 101)
  t.is(mark.height, 64)
  t.is(mark.seed, 'abc')
  t.is(mark.svgNode.attributes.viewBox, '0 0 101 64')

  const titles = findNodes(mark.svgNode, 'title')
  t.is(titles.length, 1)
  t.is(titles[0].children[0].value, 'abc')

  const clipPaths = findNodes(mark.svgNode, 'clipPath')
  t.is(clipPaths.length, 1)
  t.is(clipPaths[0].children[0].name, 'path')
})

// Guards against pattern changes caused by dependency upgrades (trianglify, blobs, ...).
// If this fails on purpose, update with: npx ava --update-snapshots
test('mark patterns stay stable across versions', async (t) => {
  for (const seed of ['alogorithm2', 'abc', '20261104']) {
    const mark = await createMarkSvgImage({ seed, width: 256, height: 256 }, dep)
    t.snapshot(svgDigest(mark), seed)
  }
})
