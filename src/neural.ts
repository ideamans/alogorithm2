import Svgson from 'svgson'
import Trianglify from 'trianglify'

import { DependencyInterface, SvgImage } from './types.js'

export interface NeuralSpec {
  seed: string
  width: number
  height: number
}

// Simple seeded PRNG (mulberry32)
function createSeededRandom(seed: string): () => number {
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0
  }
  let s = h >>> 0
  return () => {
    s |= 0
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Triangle {
  points: [number, number][]
  fill: string
}

// Parse triangle path like "M125.4,163.8L160.2,209.8L183.3,190.6Z"
function parseTrianglePath(d: string): [number, number][] | null {
  const re = /M([\d.-]+),([\d.-]+)L([\d.-]+),([\d.-]+)L([\d.-]+),([\d.-]+)Z?/
  const m = d.match(re)
  if (!m) return null
  return [
    [parseFloat(m[1]), parseFloat(m[2])],
    [parseFloat(m[3]), parseFloat(m[4])],
    [parseFloat(m[5]), parseFloat(m[6])],
  ]
}

function parsePolygons(svgChildren: Svgson.INode[]): Triangle[] {
  const triangles: Triangle[] = []
  for (const child of svgChildren) {
    if (child.name === 'path' && child.attributes.fill && child.attributes.d) {
      const points = parseTrianglePath(child.attributes.d)
      if (points) {
        triangles.push({ points, fill: child.attributes.fill })
      }
    }
    if (child.children && child.children.length > 0) {
      triangles.push(...parsePolygons(child.children))
    }
  }
  return triangles
}

function parseColor(color: string): { r: number; g: number; b: number } {
  // Handle rgb(r,g,b) format
  const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
  if (rgbMatch) {
    return { r: parseInt(rgbMatch[1]), g: parseInt(rgbMatch[2]), b: parseInt(rgbMatch[3]) }
  }
  // Handle hex format
  const h = color.replace('#', '')
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  }
}

function vertexKey(x: number, y: number): string {
  return `${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`
}

export async function createNeuralMarkSvgImage(
  spec: NeuralSpec,
  dep: Pick<DependencyInterface, 'logger' | 'markDefaults'>,
): Promise<SvgImage> {
  const seed = dep.markDefaults.seedPrefix + spec.seed

  // Generate Trianglify pattern
  const trianglify = Trianglify({
    width: spec.width,
    height: spec.height,
    variance: dep.markDefaults.variance,
    cellSize: spec.width * dep.markDefaults.cellSizeRatio,
    seed,
  })
  const trianglifySvg = await Svgson.parse(trianglify.toSVG().toString())

  // Parse triangles from SVG
  const triangles = parsePolygons(trianglifySvg.children)

  // Collect vertex info: position -> list of colors from adjacent triangles
  const vertexColors = new Map<string, { x: number; y: number; colors: string[] }>()
  for (const tri of triangles) {
    for (const [x, y] of tri.points) {
      const key = vertexKey(x, y)
      if (!vertexColors.has(key)) {
        vertexColors.set(key, { x, y, colors: [] })
      }
      vertexColors.get(key)!.colors.push(tri.fill)
    }
  }

  // Seeded PRNG for deterministic random sizes
  const rng = createSeededRandom(seed)
  const minStroke = spec.width * 0.006
  const maxStroke = spec.width * 0.024

  // Build triangle fill elements (10% opacity)
  const fillElements: Svgson.INode[] = []
  for (const tri of triangles) {
    const pts = tri.points
    const d = `M${pts[0][0]},${pts[0][1]}L${pts[1][0]},${pts[1][1]}L${pts[2][0]},${pts[2][1]}Z`
    const fillOpacity = rng() * 0.5
    fillElements.push({
      name: 'path',
      type: 'element',
      value: '',
      attributes: {
        d,
        fill: tri.fill,
        'fill-opacity': `${fillOpacity.toFixed(2)}`,
      },
      children: [],
    })
  }

  // Build edge elements (lines, no transparency)
  const edgeElements: Svgson.INode[] = []
  const drawnEdges = new Set<string>()

  for (const tri of triangles) {
    const pts = tri.points
    const edges: [[number, number], [number, number]][] = [
      [pts[0], pts[1]],
      [pts[1], pts[2]],
      [pts[2], pts[0]],
    ]

    for (const [a, b] of edges) {
      const keyA = vertexKey(a[0], a[1])
      const keyB = vertexKey(b[0], b[1])
      const edgeKey = [keyA, keyB].sort().join('-')
      if (drawnEdges.has(edgeKey)) continue
      drawnEdges.add(edgeKey)

      const strokeWidth = minStroke + rng() * (maxStroke - minStroke)
      edgeElements.push({
        name: 'line',
        type: 'element',
        value: '',
        attributes: {
          x1: `${a[0]}`,
          y1: `${a[1]}`,
          x2: `${b[0]}`,
          y2: `${b[1]}`,
          stroke: tri.fill,
          'stroke-width': `${strokeWidth.toFixed(2)}`,
        },
        children: [],
      })
    }
  }

  // Build vertex circles
  const circleRadius = 14

  const circleElements: Svgson.INode[] = []
  for (const [, vertex] of vertexColors) {
    // Average the colors from adjacent triangles
    let rSum = 0,
      gSum = 0,
      bSum = 0
    for (const color of vertex.colors) {
      const rgb = parseColor(color)
      rSum += rgb.r
      gSum += rgb.g
      bSum += rgb.b
    }
    const n = vertex.colors.length
    const avgR = Math.round(rSum / n)
    const avgG = Math.round(gSum / n)
    const avgB = Math.round(bSum / n)
    const avgColor = `rgb(${avgR},${avgG},${avgB})`

    const radius = circleRadius

    circleElements.push({
      name: 'circle',
      type: 'element',
      value: '',
      attributes: {
        cx: `${vertex.x}`,
        cy: `${vertex.y}`,
        r: `${radius.toFixed(2)}`,
        fill: avgColor,
      },
      children: [],
    })
  }

  const intWidth = Math.ceil(spec.width)
  const intHeight = Math.ceil(spec.height)
  const cx = intWidth / 2
  const cy = intHeight / 2
  const r = Math.min(intWidth, intHeight) / 2

  const markSvg: Svgson.INode = {
    name: 'svg',
    type: 'element',
    attributes: {
      xmlns: 'http://www.w3.org/2000/svg',
      'xmlns:xlink': 'http://www.w3.org/1999/xlink',
      width: `${intWidth}`,
      height: `${intHeight}`,
      viewBox: `0 0 ${intWidth} ${intHeight}`,
    },
    value: '',
    children: [
      { name: 'title', type: 'element', value: '', attributes: {}, children: [{ name: '', type: 'text', value: spec.seed, attributes: {}, children: [] }] },
      {
        name: 'defs',
        type: 'element',
        attributes: {},
        value: '',
        children: [
          {
            name: 'clipPath',
            type: 'element',
            attributes: { id: 'clip-circle' },
            value: '',
            children: [
              {
                name: 'circle',
                type: 'element',
                attributes: { cx: `${cx}`, cy: `${cy}`, r: `${r}` },
                value: '',
                children: [],
              },
            ],
          },
        ],
      },
      {
        name: 'g',
        type: 'element',
        attributes: { 'clip-path': 'url(#clip-circle)' },
        value: '',
        children: [...edgeElements, ...circleElements],
      },
    ],
  }

  return {
    svgNode: markSvg,
    width: intWidth,
    height: intHeight,
    seed: spec.seed,
  }
}
