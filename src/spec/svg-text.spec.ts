import test from 'ava'
import { svgPathBbox } from 'svg-path-bbox'
import Svgson from 'svgson'

import { applyCircleClipping, getTextSvgBoundingBox, scaleSvgPath } from '../svg.js'
import { scaledTextSvg, textToSvg } from '../text.js'

const close = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps

test('scaleSvgPath translates the path to the origin and scales it to the given size', (t) => {
  const scaled = scaleSvgPath('M10 20 L110 20 L110 70 Z', 300, 150)
  const [minX, minY, maxX, maxY] = svgPathBbox(scaled)
  t.true(close(minX, 0))
  t.true(close(minY, 0))
  t.true(close(maxX, 300))
  t.true(close(maxY, 150))
})

test('applyCircleClipping replaces clipPath children with a centered circle and keeps the rest', (t) => {
  const node: Svgson.INode = {
    name: 'svg',
    type: 'element',
    value: '',
    attributes: { width: '100' },
    children: [
      {
        name: 'defs',
        type: 'element',
        value: '',
        attributes: {},
        children: [
          {
            name: 'clipPath',
            type: 'element',
            value: '',
            attributes: { id: 'clip' },
            children: [{ name: 'path', type: 'element', value: '', attributes: { d: 'M0 0' }, children: [] }],
          },
        ],
      },
      { name: 'g', type: 'element', value: '', attributes: { 'clip-path': 'url(#clip)' }, children: [] },
    ],
  }
  const clipped = applyCircleClipping(node, 100, 60)
  const clipPath = clipped.children[0].children[0]
  t.is(clipPath.attributes.id, 'clip')
  t.deepEqual(clipPath.children, [
    { name: 'circle', type: 'element', value: '', attributes: { cx: '50', cy: '30', r: '30' }, children: [] },
  ])
  t.deepEqual(clipped.children[1], node.children[1])
  // The input must not be mutated
  t.is(node.children[0].children[0].children[0].name, 'path')
})

test('getTextSvgBoundingBox rejects SVGs that do not have exactly one path', async (t) => {
  await t.throwsAsync(() => getTextSvgBoundingBox('<svg><path d="M0 0 L1 1"/><path d="M0 0 L2 2"/></svg>'), {
    message: 'Invalid SVG',
  })
  t.deepEqual(await getTextSvgBoundingBox('<svg><path d="M1 2 L3 5"/></svg>'), [1, 2, 3, 5])
})

const baseText = {
  text: `ideaman's`,
  font: 'IBMPlexSans-SemiBold.otf',
  fontSize: 20,
  fill: '#555',
  stroke: '',
}

test('textToSvg renders a single path with fill attributes', async (t) => {
  const textSvg = await textToSvg(baseText)
  const node = await Svgson.parse(textSvg.svg)
  const paths = node.children.filter((c) => c.name === 'path')
  t.is(paths.length, 1)
  t.is(paths[0].attributes.fill, '#555')
  t.false('stroke' in paths[0].attributes)
  t.true(textSvg.width > textSvg.height * 2, 'the company name is wider than tall')
  t.true(close(textSvg.width, textSvg.boundingBox[2] - textSvg.boundingBox[0]))
})

test('textToSvg auto mode uses a class and a prefers-color-scheme style block', async (t) => {
  const textSvg = await textToSvg({ ...baseText, autoMode: true, darkFill: '#ddd', darkStroke: '' })
  t.regex(textSvg.svg, /class="logo-text"/)
  t.regex(textSvg.svg, /\.logo-text \{ fill: #555; stroke: none; \}/)
  t.regex(textSvg.svg, /@media \(prefers-color-scheme: dark\) \{\s*\.logo-text \{ fill: #ddd; stroke: none; \}/)
  t.notRegex(textSvg.svg, /fill="#555"/)
})

test('textToSvg rejects font paths containing ..', async (t) => {
  await t.throwsAsync(() => textToSvg({ ...baseText, font: '../package.json' }), { message: 'Invalid font path' })
})

test('textToSvg fails for a missing font', async (t) => {
  // opentype.js rejects with a string, not an Error
  const err = await t.throwsAsync(() => textToSvg({ ...baseText, font: 'NoSuchFont.otf' }), { any: true })
  t.regex(String(err), /ENOENT/)
})

test('scaledTextSvg scales the text path into the requested box', async (t) => {
  const textSvg = await textToSvg(baseText)
  const scaled = await scaledTextSvg(textSvg, 400, 100)
  t.is(scaled.width, 400)
  t.is(scaled.height, 100)
  t.is(scaled.svgNode.attributes.width, '400')
  const path = scaled.svgNode.children.find((c) => c.name === 'path')!
  const [minX, minY, maxX, maxY] = svgPathBbox(path.attributes.d)
  t.true(close(minX, 0, 1e-3) && close(minY, 0, 1e-3))
  t.true(close(maxX, 400, 1e-3) && close(maxY, 100, 1e-3))
})
