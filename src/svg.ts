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

// --- Circle clipping for icon avatars ---

function replaceClipPathWithCircle(node: Svgson.INode, cx: number, cy: number, r: number): Svgson.INode {
  const newNode: Svgson.INode = { ...node, attributes: { ...node.attributes } }

  if (node.name === 'clipPath') {
    // Replace clipPath children with a circle
    newNode.children = [
      {
        name: 'circle',
        type: 'element',
        attributes: {
          cx: `${cx}`,
          cy: `${cy}`,
          r: `${r}`,
        },
        value: '',
        children: [],
      },
    ]
    return newNode
  }

  if (node.children && node.children.length > 0) {
    newNode.children = node.children.map((child) => replaceClipPathWithCircle(child, cx, cy, r))
  }

  return newNode
}

export function applyCircleClipping(svgNode: Svgson.INode, width: number, height: number): Svgson.INode {
  const cx = width / 2
  const cy = height / 2
  const r = Math.min(width, height) / 2
  return replaceClipPathWithCircle(svgNode, cx, cy, r)
}
