import { createHash } from 'node:crypto'
import Fs from 'node:fs'
import Path from 'node:path'

import Sharp from 'sharp'

import { DependencyInterface } from '../types.js'

// Fixtures live at the repository root; tests are run from there (ava's default cwd).
export const fixturesDir = Path.resolve('fixtures')
export const goldenDir = Path.join(fixturesDir, 'golden')

// Set UPDATE_GOLDEN=1 to (re)write golden files instead of comparing against them.
export const updateGolden = ['1', 'true', 'yes'].includes((process.env.UPDATE_GOLDEN || '').toLowerCase())

// Same values as the hard-coded defaults of Dependency, but without the pino-pretty transport
// (a worker thread) so that unit tests stay hermetic and are not affected by environment variables.
export function testDependency(): DependencyInterface {
  return {
    defaults: { seed: 'alogorithm2', serverPort: 3001, serverHost: '127.0.0.1' },
    logoTextDefaults: {
      text: `ideaman's`,
      fill: '#555',
      stroke: '',
      font: 'IBMPlexSans-SemiBold.otf',
      darkFill: '#ddd',
      darkStroke: '',
      colorTheme: 'auto',
    },
    markDefaults: { seedPrefix: `ideaman's `, variance: 1.5, cellSizeRatio: 0.2, extraPoints: 8, randomness: 4 },
    inlineDefaults: { paddingRatio: 0.2, width: 512 },
    iconDefaults: { size: 64 },
    rectDefaults: { size: 512 },
  }
}

export function sha256(data: string | Buffer): string {
  return createHash('sha256').update(data).digest('hex')
}

export interface PngChunk {
  type: string
  data: Buffer
}

// Minimal PNG chunk reader (no decompression) used to verify structure independently of sharp.
export function readPngChunks(png: Buffer): PngChunk[] {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  if (!png.subarray(0, 8).equals(signature)) throw new Error('Not a PNG')
  const chunks: PngChunk[] = []
  let offset = 8
  while (offset < png.length) {
    const length = png.readUInt32BE(offset)
    const type = png.subarray(offset + 4, offset + 8).toString('ascii')
    const data = png.subarray(offset + 8, offset + 8 + length)
    chunks.push({ type, data })
    offset += 12 + length
  }
  return chunks
}

export function pngSize(png: Buffer): { width: number; height: number } {
  const ihdr = readPngChunks(png)[0]
  if (ihdr.type !== 'IHDR') throw new Error('IHDR is not the first chunk')
  return { width: ihdr.data.readUInt32BE(0), height: ihdr.data.readUInt32BE(4) }
}

export function pngTextChunks(png: Buffer): Record<string, string> {
  const texts: Record<string, string> = {}
  for (const chunk of readPngChunks(png)) {
    if (chunk.type !== 'tEXt') continue
    const nul = chunk.data.indexOf(0)
    texts[chunk.data.subarray(0, nul).toString('latin1')] = chunk.data.subarray(nul + 1).toString('latin1')
  }
  return texts
}

export interface PixelDiff {
  width: number
  height: number
  meanAbsDiff: number // average absolute difference per channel value (0-255)
  maxAbsDiff: number
  differingRatio: number // ratio of channel values that differ by more than 8
}

export async function comparePixels(actual: Buffer, expected: Buffer): Promise<PixelDiff> {
  const a = await Sharp(actual).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const e = await Sharp(expected).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  if (a.info.width !== e.info.width || a.info.height !== e.info.height) {
    throw new Error(`Size mismatch: ${a.info.width}x${a.info.height} vs ${e.info.width}x${e.info.height}`)
  }
  let sum = 0
  let max = 0
  let differing = 0
  for (let i = 0; i < a.data.length; i++) {
    const d = Math.abs(a.data[i] - e.data[i])
    sum += d
    if (d > max) max = d
    if (d > 8) differing++
  }
  return {
    width: a.info.width,
    height: a.info.height,
    meanAbsDiff: sum / a.data.length,
    maxAbsDiff: max,
    differingRatio: differing / a.data.length,
  }
}

export function readOrWriteGolden(name: string, actual: Buffer | string): Buffer {
  const path = Path.join(goldenDir, name)
  if (updateGolden || !Fs.existsSync(path)) {
    if (!updateGolden) throw new Error(`Golden file ${path} is missing. Run with UPDATE_GOLDEN=1 to create it.`)
    Fs.mkdirSync(goldenDir, { recursive: true })
    Fs.writeFileSync(path, actual)
  }
  return Fs.readFileSync(path)
}
