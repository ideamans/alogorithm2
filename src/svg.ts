import { svgPathBbox } from 'svg-path-bbox'
import { SVGPathData } from 'svg-pathdata'
import Svgson from 'svgson'

export type BoundingBox = [number, number, number, number]

export async function getTextSvgBoundingBox(svg: string): Promise<BoundingBox> {
  const svgson = await Svgson.parse(svg)
  const paths = svgson.children.filter((child) => child.name === 'path')
  if (paths.length !== 1) throw new Error('Invalid SVG')

  const bbox: BoundingBox = [-Infinity, -Infinity, Infinity, Infinity]
  for (const path of paths) {
    const pathBbox = await svgPathBbox(path.attributes.d)
    bbox[0] = Math.max(bbox[0], pathBbox[0])
    bbox[1] = Math.max(bbox[1], pathBbox[1])
    bbox[2] = Math.min(bbox[2], pathBbox[2])
    bbox[3] = Math.min(bbox[3], pathBbox[3])
  }

  return bbox
}

export function scaleSvgPath(svgPath: string, width: number, height: number): string {
  const [minX, minY, maxX, maxY] = svgPathBbox(svgPath)
  const scaleX = width / (maxX - minX)
  const scaleY = height / (maxY - minY)

  const paths = new SVGPathData(svgPath)
  const scaled = paths.translate(-minX, -minY).scale(scaleX, scaleY).encode()

  return scaled
}

// --- Shape clipping for icon avatars ---

function createElement(name: string, attributes: Record<string, number>): Svgson.INode {
  const attrs: Record<string, string> = {}
  for (const [key, value] of Object.entries(attributes)) attrs[key] = `${value}`
  return { name, type: 'element', attributes: attrs, value: '', children: [] }
}

// Replace the children of every clipPath with the given shape
function replaceClipPathWith(node: Svgson.INode, shape: Svgson.INode): Svgson.INode {
  const newNode: Svgson.INode = { ...node, attributes: { ...node.attributes } }

  if (node.name === 'clipPath') {
    newNode.children = [shape]
    return newNode
  }

  if (node.children && node.children.length > 0) {
    newNode.children = node.children.map((child) => replaceClipPathWith(child, shape))
  }

  return newNode
}

export function applyCircleClipping(svgNode: Svgson.INode, width: number, height: number): Svgson.INode {
  const r = Math.min(width, height) / 2
  return replaceClipPathWith(svgNode, createElement('circle', { cx: width / 2, cy: height / 2, r }))
}

// Clip to a centered square whose side is the shorter edge.
// radius is the corner radius as a ratio of the side (0 = sharp corners, 0.5 = circle).
export function applySquareClipping(svgNode: Svgson.INode, width: number, height: number, radius = 0): Svgson.INode {
  const size = Math.min(width, height)
  const r = size * Math.min(Math.max(radius, 0), 0.5)
  const rect = createElement('rect', {
    x: (width - size) / 2,
    y: (height - size) / 2,
    width: size,
    height: size,
    rx: r,
    ry: r,
  })
  return replaceClipPathWith(svgNode, rect)
}
