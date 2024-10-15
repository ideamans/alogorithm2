import Fastify, { FastifyReply } from 'fastify'
import Sharp from 'sharp'
import Svgson from 'svgson'

import { Dependency } from './dependency.js'
import { DependencyInterface, SvgImage } from './types.js'
import { createInlineSvgImage } from './inline.js'
import { createRectSvgImage } from './rect.js'
import { createIconSvgImage } from './icon.js'

interface ImageParams {
  format: string
}

interface CommonQuery {
  seed: string
}

interface InlineQuery extends CommonQuery {
  width?: string
}

interface RectQuery extends CommonQuery {
  width?: string
  height?: string
}

interface IconQuery extends CommonQuery {
  width?: string
  height?: string
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

      const png = await sharp
        .composite([{ input: Buffer.from(svg) }])
        .png()
        .toBuffer()

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
    const { seed, width } = request.query

    const svgImage = await createInlineSvgImage(
      {
        seed: seed || dep.defaults.seed,
        width: Number(width || dep.inlineDefaults.width),
      },
      dep,
    )

    return await safeReplySvgImageAs(svgImage, format, reply)
  })

  server.get<{ Params: ImageParams; Querystring: RectQuery }>('/v2/rect.:format', async (request, reply) => {
    const { format } = request.params
    const { seed, width, height } = request.query

    const svgImage = await createRectSvgImage(
      {
        seed: seed || dep.defaults.seed,
        width: Number(width || dep.rectDefaults.size),
        height: Number(height || width || dep.rectDefaults.size),
      },
      dep,
    )

    return await safeReplySvgImageAs(svgImage, format, reply)
  })

  server.get<{ Params: ImageParams; Querystring: IconQuery }>('/v2/icon.:format', async (request, reply) => {
    const { format } = request.params
    const { seed, width, height } = request.query

    const svgImage = await createIconSvgImage(
      {
        seed: seed || dep.defaults.seed,
        width: Number(width || dep.iconDefaults.size),
        height: Number(height || width || dep.iconDefaults.size),
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
