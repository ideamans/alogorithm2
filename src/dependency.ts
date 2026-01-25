import Pino from 'pino'

import {
  Defaults,
  DependencyInterface,
  IconDefaults,
  InlineDefaults,
  LogoTextDefaults,
  MarkDefaults,
  RectDefaults,
} from './types.js'

export class Dependency implements DependencyInterface {
  logger: Pino.Logger

  defaults: Defaults
  logoTextDefaults: LogoTextDefaults
  markDefaults: MarkDefaults
  inlineDefaults: InlineDefaults
  iconDefaults: IconDefaults
  rectDefaults: RectDefaults

  constructor() {
    this.logger = Pino({
      level: process.env.LOG_LEVEL || 'info',
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          ignore: 'pid,hostname',
          hideObject: !['', '0', 'false', 'no', undefined].includes(process.env.LOG_OBJECTS?.toLowerCase()),
        },
      },
    })

    this.defaults = {
      seed: process.env.DEFAULT_SEED || 'alogorithm2',
      serverPort: Number(process.env.PORT || '3001'),
      serverHost: process.env.HOST || '0.0.0.0',
    }

    this.logoTextDefaults = {
      text: process.env.LOGO_TEXT || `ideaman's`,
      fill: process.env.LOGO_FILL || '#555',
      stroke: process.env.LOGO_STROKE || '',
      font: process.env.LOGO_FONT || 'IBMPlexSans-SemiBold.otf',
      darkFill: process.env.LOGO_DARK_FILL || '#ddd',
      darkStroke: process.env.LOGO_DARK_STROKE || '',
      colorTheme: 'auto',
    }

    this.markDefaults = {
      seedPrefix: process.env.SEED_PREFIX || `ideaman's `,
      variance: Number(process.env.MARK_VARIANCE || '1.5'),
      cellSizeRatio: Number(process.env.MARK_CELL_SIZE_RATIO || '0.2'),
      extraPoints: Number(process.env.MARK_EXTRA_POINTS || '8'),
      randomness: Number(process.env.MARK_RANDOMNESS || '4'),
    }

    this.inlineDefaults = {
      paddingRatio: Number(process.env.INLINE_PADDING_RATIO || '0.2'),
      width: Number(process.env.INLINE_WIDTH || '512'),
    }

    this.iconDefaults = {
      size: Number(process.env.ICON_SIZE || '64'),
    }

    this.rectDefaults = {
      size: Number(process.env.ICON_SIZE || '512'),
    }
  }
}
