import Svgson from 'svgson'

import { ColorTheme, DependencyInterface, SvgImage } from './types.js'
import { scaledTextSvg, textToSvg } from './text.js'
import { createMarkSvgImage } from './mark.js'

export interface InlineSvgImageInput {
  seed: string
  width: number
  colorTheme: ColorTheme
}

export async function createInlineSvgImage(
  input: InlineSvgImageInput,
  dep: Pick<DependencyInterface, 'logoTextDefaults' | 'markDefaults' | 'inlineDefaults'>,
): Promise<SvgImage> {
  const paddingRatio = dep.inlineDefaults.paddingRatio

  // Text
  const textSvg = await textToSvg({
    ...dep.logoTextDefaults,
    fill: input.colorTheme === 'dark' ? dep.logoTextDefaults.darkFill : dep.logoTextDefaults.fill,
    stroke: input.colorTheme === 'dark' ? dep.logoTextDefaults.darkStroke : dep.logoTextDefaults.stroke,
    fontSize: 20, // Text will be scaled later so any value is fine
  })

  // Calculate dimensions
  const textAspectRatio = textSvg.width / textSvg.height
  const logoHeight = input.width / (textAspectRatio - 2 * paddingRatio * textAspectRatio + paddingRatio + 1)
  const textWidth = input.width - logoHeight - logoHeight * paddingRatio
  const textHeight = textWidth / textAspectRatio
  const textLeft = logoHeight + logoHeight * paddingRatio
  const textTop = logoHeight * paddingRatio

  // Scale text
  const scaledText = await scaledTextSvg(textSvg, textWidth, textHeight)

  // Mark
  const mark = await createMarkSvgImage({ seed: input.seed, width: logoHeight, height: logoHeight }, dep)

  // Build SVG
  const intWidth = Math.ceil(input.width)
  const intHeight = Math.ceil(logoHeight)
  const svg: Svgson.INode = {
    name: 'svg',
    type: 'element',
    value: '',
    attributes: {
      xmlns: 'http://www.w3.org/2000/svg',
      'xmlns:xlink': 'http://www.w3.org/1999/xlink',
      width: `${intWidth}`,
      height: `${intHeight}`,
      viewBox: `0 0 ${intWidth} ${intHeight}`,
    },
    children: [
      ...mark.svgNode.children,
      {
        name: 'g',
        type: 'element',
        value: '',
        attributes: {
          transform: `translate(${textLeft}, ${textTop})`,
        },
        children: scaledText.svgNode.children,
      },
    ],
  }

  return { svgNode: svg, width: intWidth, height: intHeight }
}
