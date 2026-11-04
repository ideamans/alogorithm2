import test from 'ava'
import { svgPathBbox } from 'svg-path-bbox'
import Svgson from 'svgson'

import { applyCircleClipping, applySquareClipping, scaleSvgPath } from './svg.js'

function element(name: string, children: Svgson.INode[] = [], attributes: Record<string, string> = {}): Svgson.INode {
  return { name, type: 'element', value: '', attributes, children }
}

// svg > defs > clipPath > path, plus a clipped group
function sampleSvg(): Svgson.INode {
  return element('svg', [
    element('defs', [element('clipPath', [element('path', [], { d: 'M0 0L10 10Z' })], { id: 'clip' })]),
    element('g', [element('path', [], { d: 'M1 1L2 2Z' })], { 'clip-path': 'url(#clip)' }),
  ])
}

function clipShape(svg: Svgson.INode): Svgson.INode {
  const clipPath = svg.children[0].children[0]
  if (clipPath.name !== 'clipPath' || clipPath.children.length !== 1) throw new Error('clipPath not found')
  return clipPath.children[0]
}

test('applyCircleClipping replaces the clip path with a centered circle', (t) => {
  const shape = clipShape(applyCircleClipping(sampleSvg(), 100, 100))
  t.is(shape.name, 'circle')
  t.deepEqual(shape.attributes, { cx: '50', cy: '50', r: '50' })
})

test('applyCircleClipping uses the shorter side as the diameter', (t) => {
  const shape = clipShape(applyCircleClipping(sampleSvg(), 300, 200))
  t.deepEqual(shape.attributes, { cx: '150', cy: '100', r: '100' })
})

test('applySquareClipping without radius makes a sharp square', (t) => {
  const shape = clipShape(applySquareClipping(sampleSvg(), 100, 100))
  t.is(shape.name, 'rect')
  t.deepEqual(shape.attributes, { x: '0', y: '0', width: '100', height: '100', rx: '0', ry: '0' })
})

test('applySquareClipping applies radius as a ratio of the side', (t) => {
  const shape = clipShape(applySquareClipping(sampleSvg(), 200, 200, 0.25))
  t.is(shape.attributes.rx, '50')
  t.is(shape.attributes.ry, '50')
})

test('applySquareClipping clamps radius to 0..0.5', (t) => {
  t.is(clipShape(applySquareClipping(sampleSvg(), 100, 100, 2)).attributes.rx, '50')
  t.is(clipShape(applySquareClipping(sampleSvg(), 100, 100, -1)).attributes.rx, '0')
})

test('applySquareClipping centers a square of the shorter side', (t) => {
  const shape = clipShape(applySquareClipping(sampleSvg(), 300, 200, 0.1))
  t.deepEqual(shape.attributes, { x: '50', y: '0', width: '200', height: '200', rx: '20', ry: '20' })
})

test('clipping does not mutate the input and keeps the clipped content', (t) => {
  const input = sampleSvg()
  const before = JSON.stringify(input)
  const output = applySquareClipping(input, 100, 100, 0.2)
  t.is(JSON.stringify(input), before)
  t.deepEqual(output.children[1], input.children[1])
})

test('scaleSvgPath fits the path into the given size', (t) => {
  const scaled = scaleSvgPath('M10 20L30 20L30 60Z', 100, 50)
  t.deepEqual(
    svgPathBbox(scaled).map((v) => Math.round(v * 1e6) / 1e6),
    [0, 0, 100, 50],
  )
})
