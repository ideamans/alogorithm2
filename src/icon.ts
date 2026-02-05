import { createMarkSvgImage } from './mark.js'
import { applyRoundedDistortion } from './svg.js'
import { DependencyInterface, SvgImage } from './types.js'

export interface IconSvgImageInput {
  seed: string
  width: number
  height: number
  rounded?: number
}

export async function createIconSvgImage(
  input: IconSvgImageInput,
  dep: Pick<DependencyInterface, 'logger' | 'markDefaults'>,
): Promise<SvgImage> {
  const mark = await createMarkSvgImage({ seed: input.seed, width: input.width, height: input.height }, dep)
  const width = Math.ceil(input.width)
  const height = Math.ceil(input.height)

  let svgNode = mark.svgNode
  if (input.rounded && input.rounded > 0) {
    svgNode = applyRoundedDistortion(svgNode, width, height, input.rounded)
  }

  return {
    svgNode,
    width,
    height,
  }
}
