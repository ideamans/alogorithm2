import Pino from 'pino'
import Svgson from 'svgson'

export interface Defaults {
  seed: string
  serverPort: number
  serverHost: string
}

export interface LogoTextDefaults {
  text: string
  fill: string
  stroke: string
  font: string
}

export interface MarkDefaults {
  seedPrefix: string
  variance: number
  cellSizeRatio: number
  extraPoints: number
  randomness: number
}

export interface InlineDefaults {
  paddingRatio: number
  width: number
}

export interface IconDefaults {
  size: number
}

export interface RectDefaults {
  size: number
}

export interface DependencyInterface {
  logger?: Pino.Logger
  defaults: Defaults
  logoTextDefaults: LogoTextDefaults
  markDefaults: MarkDefaults
  inlineDefaults: InlineDefaults
  iconDefaults: IconDefaults
  rectDefaults: RectDefaults
}

export interface SvgImage {
  svgNode: Svgson.INode
  width: number
  height: number
}
