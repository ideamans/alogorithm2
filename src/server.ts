import { crc32 } from 'node:zlib'

import Fastify, { FastifyReply } from 'fastify'
import Sharp from 'sharp'
import Svgson from 'svgson'

import { Dependency } from './dependency.js'
import { createIconSvgImage } from './icon.js'
import { createInlineCustomSvgImage, createInlineSvgImage } from './inline.js'
import { createRectSvgImage } from './rect.js'
import { ColorTheme, DependencyInterface, SvgImage } from './types.js'

interface ImageParams {
  format: string
}

interface CommonQuery {
  seed: string
}

interface InlineQuery extends CommonQuery {
  width?: string
  colorTheme?: ColorTheme
}

interface InlineCustomQuery extends CommonQuery {
  text?: string
  height?: string
  colorTheme?: ColorTheme
}

interface RectQuery extends CommonQuery {
  width?: string
  height?: string
  colorTheme?: ColorTheme
}

interface IconQuery extends CommonQuery {
  width?: string
  height?: string
  circle?: string
}

// Insert a PNG tEXt chunk (keyword + text) right after the IHDR chunk
function insertPngTextChunk(png: Buffer, keyword: string, text: string): Buffer {
  const keyBuf = Buffer.from(keyword, 'latin1')
  const nul = Buffer.from([0])
  const textBuf = Buffer.from(text, 'latin1')
  const chunkData = Buffer.concat([keyBuf, nul, textBuf])

  const length = Buffer.alloc(4)
  length.writeUInt32BE(chunkData.length, 0)

  const type = Buffer.from('tEXt', 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([type, chunkData])) >>> 0, 0)

  const chunk = Buffer.concat([length, type, chunkData, crc])

  // PNG: 8-byte signature + IHDR chunk (4 len + 4 type + 13 data + 4 crc = 25 bytes)
  const insertAt = 8 + 25
  return Buffer.concat([png.subarray(0, insertAt), chunk, png.subarray(insertAt)])
}

export async function safeReplySvgImageAs(svgImage: SvgImage, format: string, reply: FastifyReply) {
  try {
    const svg = Svgson.stringify(svgImage.svgNode)

    if (format === 'png') {
      const sharp = Sharp({
        create: {
          width: Math.ceil(svgImage.width),
          height: Math.ceil(svgImage.height),
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
      })

      let png = await sharp
        .composite([{ input: Buffer.from(svg) }])
        .png()
        .toBuffer()

      if (svgImage.seed) {
        png = insertPngTextChunk(png, 'Seed', svgImage.seed)
      }

      reply.header('Content-Type', 'image/png')
      reply.send(png)

      return reply
    } else {
      reply.header('Content-Type', 'image/svg+xml')
      reply.send(svg)
      return reply
    }
  } catch (err) {
    reply.status(500)
    reply.header('Content-Type', 'application/json')
    reply.send({ err })
    return reply
  }
}

export function createServer(dep: DependencyInterface) {
  const server = Fastify()

  server.get<{ Params: ImageParams; Querystring: InlineQuery }>('/v2/inline.:format', async (request, reply) => {
    const { format } = request.params
    const { seed, width, colorTheme } = request.query

    const svgImage = await createInlineSvgImage(
      {
        seed: seed || dep.defaults.seed,
        width: Number(width || dep.inlineDefaults.width),
        colorTheme: colorTheme || dep.logoTextDefaults.colorTheme,
      },
      dep,
    )

    return await safeReplySvgImageAs(svgImage, format, reply)
  })

  server.get<{ Params: ImageParams; Querystring: InlineCustomQuery }>(
    '/v2/inline-custom.:format',
    async (request, reply) => {
      const { format } = request.params
      const { seed, text, height, colorTheme } = request.query

      const svgImage = await createInlineCustomSvgImage(
        {
          seed: seed || dep.defaults.seed,
          text: text || dep.logoTextDefaults.text,
          height: Number(height || dep.inlineDefaults.width / 4), // Default height based on reasonable ratio
          colorTheme: colorTheme || dep.logoTextDefaults.colorTheme,
        },
        dep,
      )

      return await safeReplySvgImageAs(svgImage, format, reply)
    },
  )

  server.get<{ Params: ImageParams; Querystring: RectQuery }>('/v2/rect.:format', async (request, reply) => {
    const { format } = request.params
    const { seed, width, height, colorTheme } = request.query

    const svgImage = await createRectSvgImage(
      {
        seed: seed || dep.defaults.seed,
        width: Number(width || dep.rectDefaults.size),
        height: Number(height || width || dep.rectDefaults.size),
        colorTheme: colorTheme || dep.logoTextDefaults.colorTheme,
      },
      dep,
    )

    return await safeReplySvgImageAs(svgImage, format, reply)
  })

  server.get<{ Params: ImageParams; Querystring: IconQuery }>('/v2/icon.:format', async (request, reply) => {
    const { format } = request.params
    const { seed, width, height, circle } = request.query

    const svgImage = await createIconSvgImage(
      {
        seed: seed || dep.defaults.seed,
        width: Number(width || dep.iconDefaults.size),
        height: Number(height || width || dep.iconDefaults.size),
        circle: circle === '1',
      },
      dep,
    )

    return await safeReplySvgImageAs(svgImage, format, reply)
  })

  return server
}

export async function startServer(dep?: Dependency) {
  if (!dep) {
    dep = new Dependency()
  }

  const server = createServer(dep)
  const host = dep.defaults.serverHost
  const port = dep.defaults.serverPort

  server.listen({ host, port }, (err) => {
    if (err) {
      dep.logger.error({ err }, `Failed to start server on ${host}:${port}`)
      process.exit(1)
    }

    dep.logger.info(`Server listening on ${host}:${port}`)
  })

  const shutdown = async () => {
    dep.logger.info('Shutting down server')
    try {
      await server.close()
      dep.logger.info('Server shut down')
      process.exit(0)
    } catch (err) {
      dep.logger.error({ err }, 'Failed to shut down server')
      process.exit(1)
    }
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  return server
}
