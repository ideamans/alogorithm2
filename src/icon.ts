import { createMarkSvgImage } from './mark.js'
import { applyCircleClipping, applySquareClipping } from './svg.js'
import { DependencyInterface, SvgImage } from './types.js'

export interface IconSvgImageInput {
  seed: string
  width: number
  height: number
  circle?: boolean
  square?: boolean
  radius?: number
}

export async function createIconSvgImage(
  input: IconSvgImageInput,
  dep: Pick<DependencyInterface, 'logger' | 'markDefaults'>,
): Promise<SvgImage> {
  const mark = await createMarkSvgImage({ seed: input.seed, width: input.width, height: input.height }, dep)
  const width = Math.ceil(input.width)
  const height = Math.ceil(input.height)

  let svgNode = mark.svgNode
  if (input.circle) {
    svgNode = applyCircleClipping(svgNode, width, height)
  } else if (input.square) {
    svgNode = applySquareClipping(svgNode, width, height, input.radius)
  }

  return {
    svgNode,
    width,
    height,
    seed: input.seed,
  }
}
