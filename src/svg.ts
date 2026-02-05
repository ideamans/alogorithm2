import { svgPathBbox } from 'svg-path-bbox'
import { type SVGCommand, SVGPathData } from 'svg-pathdata'
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

// --- Spherical (rounded) distortion for icon avatars ---

const DEFAULT_ROUNDED_STRENGTH = 0.3

type PointDistorter = (x: number, y: number) => [number, number]

function createSphericalDistorter(cx: number, cy: number, maxR: number, strength: number): PointDistorter {
  return (x: number, y: number): [number, number] => {
    const dx = x - cx
    const dy = y - cy
    const r = Math.sqrt(dx * dx + dy * dy)
    if (r === 0) return [x, y]
    const rNorm = r / maxR
    const rNorm2 = rNorm * rNorm
    const factor = 1 - strength * rNorm2 * rNorm2
    return [cx + dx * factor, cy + dy * factor]
  }
}

function distortPathData(pathData: string, distort: PointDistorter): string {
  const path = new SVGPathData(pathData).toAbs()
  let curX = 0
  let curY = 0

  for (let i = 0; i < path.commands.length; i++) {
    const cmd = path.commands[i]

    if (cmd.type === SVGPathData.CLOSE_PATH) {
      continue
    }

    // cspell:disable-next-line
    if (cmd.type === SVGPathData.HORIZ_LINE_TO) {
      curX = cmd.x
      const [nx, ny] = distort(curX, curY)
      path.commands[i] = { type: SVGPathData.LINE_TO, relative: false, x: nx, y: ny } as SVGCommand
      continue
    }

    if (cmd.type === SVGPathData.VERT_LINE_TO) {
      curY = cmd.y
      const [nx, ny] = distort(curX, curY)
      path.commands[i] = { type: SVGPathData.LINE_TO, relative: false, x: nx, y: ny } as SVGCommand
      continue
    }

    // Control points for cubic/quadratic bezier
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = cmd as any
    if ('x1' in c && 'y1' in c) {
      ;[c.x1, c.y1] = distort(c.x1, c.y1)
    }
    if ('x2' in c && 'y2' in c) {
      ;[c.x2, c.y2] = distort(c.x2, c.y2)
    }

    // Endpoint
    if ('x' in c && 'y' in c) {
      curX = c.x
      curY = c.y
      ;[c.x, c.y] = distort(curX, curY)
    }
  }

  return path.encode()
}

function distortSvgNode(node: Svgson.INode, distort: PointDistorter, inClipPath: boolean): Svgson.INode {
  const newNode: Svgson.INode = { ...node, attributes: { ...node.attributes } }
  const isClipPath = node.name === 'clipPath'

  if (inClipPath && node.name === 'path' && node.attributes.d) {
    newNode.attributes.d = distortPathData(node.attributes.d, distort)
  }

  if (node.children && node.children.length > 0) {
    newNode.children = node.children.map((child) => distortSvgNode(child, distort, inClipPath || isClipPath))
  }

  return newNode
}

export function applyRoundedDistortion(
  svgNode: Svgson.INode,
  width: number,
  height: number,
  rounded: number,
): Svgson.INode {
  const strength = rounded * DEFAULT_ROUNDED_STRENGTH
  const cx = width / 2
  const cy = height / 2
  const maxR = Math.sqrt(cx * cx + cy * cy)
  const distort = createSphericalDistorter(cx, cy, maxR, strength)
  return distortSvgNode(svgNode, distort, false)
}
