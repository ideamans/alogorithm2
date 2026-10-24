import test from 'ava'
import Svgson from 'svgson'

import { createIconSvgImage } from '../icon.js'
import { createInlineCustomSvgImage, createInlineSvgImage } from '../inline.js'
import { createMarkSvgImage } from '../mark.js'
import { createRectSvgImage } from '../rect.js'
import { SvgImage } from '../types.js'

import { readOrWriteGolden, testDependency } from './helpers.js'

const dep = testDependency()

function findAll(node: Svgson.INode, name: string): Svgson.INode[] {
  const found = node.name === name ? [node] : []
  for (const child of node.children || []) found.push(...findAll(child, name))
  return found
}

function stringify(image: SvgImage) {
  return Svgson.stringify(image.svgNode)
}

test('mark: size, title, clip path and trianglify polygons', async (t) => {
  const mark = await createMarkSvgImage({ seed: 'abc', width: 100.4, height: 80 }, dep)
  t.is(mark.width, 101)
  t.is(mark.height, 80)
  t.is(mark.seed, 'abc')
  const attrs = mark.svgNode.attributes
  t.is(attrs.width, '101')
  t.is(attrs.height, '80')
  t.is(attrs.viewBox, '0 0 101 80')
  t.is(mark.svgNode.children[0].name, 'title')
  t.is(mark.svgNode.children[0].children[0].value, 'abc')
  t.is(findAll(mark.svgNode, 'clipPath').length, 1)
  t.true(findAll(mark.svgNode, 'path').length > 10, 'trianglify generated polygons')
})

test('mark: same seed is deterministic, different seeds differ', async (t) => {
  const a1 = stringify(await createMarkSvgImage({ seed: 'same', width: 64, height: 64 }, dep))
  const a2 = stringify(await createMarkSvgImage({ seed: 'same', width: 64, height: 64 }, dep))
  const b = stringify(await createMarkSvgImage({ seed: 'other', width: 64, height: 64 }, dep))
  t.is(a1, a2)
  t.not(a1, b)
})

test('icon: circle option replaces the blob clip path with a circle', async (t) => {
  const blob = await createIconSvgImage({ seed: 's', width: 64, height: 48 }, dep)
  const circle = await createIconSvgImage({ seed: 's', width: 64, height: 48, circle: true }, dep)
  t.is(findAll(blob.svgNode, 'circle').length, 0)
  t.deepEqual(findAll(circle.svgNode, 'circle')[0].attributes, { cx: '32', cy: '24', r: '24' })
  t.is(circle.width, 64)
  t.is(circle.height, 48)
})

test('inline: height derives from width and the text aspect ratio', async (t) => {
  const image = await createInlineSvgImage({ seed: 'x', width: 512, colorTheme: 'light' }, dep)
  t.is(image.width, 512)
  t.true(image.height > 50 && image.height < 200, `height=${image.height}`)
  const svg = stringify(image)
  t.regex(svg, /fill="#555"/)
  t.is(findAll(image.svgNode, 'title').length, 1, 'title is not duplicated')
})

test('inline: dark and auto color themes', async (t) => {
  const dark = stringify(await createInlineSvgImage({ seed: 'x', width: 256, colorTheme: 'dark' }, dep))
  t.regex(dark, /fill="#ddd"/)
  const auto = stringify(await createInlineSvgImage({ seed: 'x', width: 256, colorTheme: 'auto' }, dep))
  t.regex(auto, /prefers-color-scheme: dark/)
})

test('inline-custom: width grows with the custom text', async (t) => {
  const short = await createInlineCustomSvgImage({ seed: 'x', height: 100, text: 'ab', colorTheme: 'light' }, dep)
  const long = await createInlineCustomSvgImage({ seed: 'x', height: 100, text: 'abcdefgh', colorTheme: 'light' }, dep)
  t.is(short.height, 100)
  t.is(long.height, 100)
  t.true(long.width > short.width)
})

test('rect: requested size and text placed at the bottom', async (t) => {
  const image = await createRectSvgImage({ seed: 'x', width: 300, height: 400, colorTheme: 'light' }, dep)
  t.is(image.width, 300)
  t.is(image.height, 400)
  const textGroup = image.svgNode.children[image.svgNode.children.length - 1]
  t.regex(textGroup.attributes.transform, /^translate\(0, \d+(\.\d+)?\)$/)
})

// Golden SVGs pin the exact output for representative inputs. SVG generation is pure JS
// (trianglify, blobs, text-to-svg, svgson), so any byte change means the logo changed.
const goldenCases: [string, () => Promise<SvgImage>][] = [
  ['icon-default.svg', () => createIconSvgImage({ seed: 'alogorithm2', width: 64, height: 64 }, dep)],
  ['icon-circle.svg', () => createIconSvgImage({ seed: 'circle', width: 128, height: 128, circle: true }, dep)],
  ['inline-light.svg', () => createInlineSvgImage({ seed: 'alogorithm2', width: 512, colorTheme: 'light' }, dep)],
  ['inline-auto.svg', () => createInlineSvgImage({ seed: 'golden', width: 300, colorTheme: 'auto' }, dep)],
  [
    'inline-custom.svg',
    () => createInlineCustomSvgImage({ seed: 'custom', height: 80, text: 'Hello', colorTheme: 'dark' }, dep),
  ],
  [
    'rect-default.svg',
    () => createRectSvgImage({ seed: 'alogorithm2', width: 512, height: 512, colorTheme: 'auto' }, dep),
  ],
]

for (const [name, create] of goldenCases) {
  test(`golden SVG: ${name}`, async (t) => {
    const svg = stringify(await create())
    const golden = readOrWriteGolden(name, svg).toString('utf8')
    t.is(svg, golden)
  })
}
