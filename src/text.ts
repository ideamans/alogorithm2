import Path from 'path'

import TextToSvg from 'text-to-svg'
import Svgson from 'svgson'
import { SVGPathData } from 'svg-pathdata'

import { BoundingBox, getTextSvgBoundingBox } from './svg.js'
import TextToSVG from 'text-to-svg'
import { SvgImage } from './types.js'

export interface TextSpec {
  text: string
  font: string
  fontSize: number
  fill: string
  stroke: string
}

export interface TextSvg {
  svg: string
  boundingBox: BoundingBox
  width: number
  height: number
}

const cache = new Map<string, TextSvg>()

export async function textToSvg(spec: TextSpec): Promise<TextSvg> {
  const key = JSON.stringify(spec)
  if (cache.has(key)) {
    return cache.get(key)!
  }

  if (spec.font.includes('..')) throw new Error('Invalid font path')
  const fontPath = Path.join('./fonts', spec.font)
  const textToSvg = await new Promise<TextToSVG | null>((ok, ng) => {
    TextToSvg.load(fontPath, (err, textToSvg) => {
      if (err) ng(err)
      else ok(textToSvg)
    })
  })
  if (!textToSvg) throw new Error('Invalid font')

  const attributes: { [key: string]: string } = { fill: spec.fill }
  if (spec.stroke) attributes['stroke'] = spec.stroke

  const svg = textToSvg.getSVG(spec.text, {
    x: 0,
    y: 0,
    fontSize: spec.fontSize,
    anchor: 'left top',
    letterSpacing: -0.02,
    attributes,
  })

  const boundingBox = await getTextSvgBoundingBox(svg)
  const textSvg = { svg, boundingBox, width: boundingBox[2] - boundingBox[0], height: boundingBox[3] - boundingBox[1] }
  cache.set(key, textSvg)

  return textSvg
}

export async function scaledTextSvg(textSvg: TextSvg, width: number, height: number): Promise<SvgImage> {
  const [minX, minY, maxX, maxY] = textSvg.boundingBox
  const scaleX = width / (maxX - minX)
  const scaleY = height / (maxY - minY)

  const svgson = await Svgson.parse(textSvg.svg)
  for (const child of svgson.children) {
    if (child.name !== 'path') continue
    const path = new SVGPathData(child.attributes.d)
    const scaled = path.translate(-minX, -minY).scale(scaleX, scaleY).encode()
    child.attributes.d = scaled
  }
  svgson.attributes.width = String(width)
  svgson.attributes.height = String(height)

  return { svgNode: svgson, width, height }
}
