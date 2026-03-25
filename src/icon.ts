import { createMarkSvgImage } from './mark.js'
import { applyCircleClipping } from './svg.js'
import { DependencyInterface, SvgImage } from './types.js'

export interface IconSvgImageInput {
  seed: string
  width: number
  height: number
  circle?: boolean
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
  }

  return {
    svgNode,
    width,
    height,
    seed: input.seed,
  }
}
