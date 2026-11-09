import { createHash } from 'node:crypto'

import Svgson from 'svgson'

import { Dependency } from './dependency.js'
import { SvgImage } from './types.js'

// Shared by *.spec.ts. Uses the real defaults (as the server does) with a silent logger.
export function createTestDependency(): Dependency {
  const prev = process.env.LOG_LEVEL
  process.env.LOG_LEVEL = 'silent'
  try {
    return new Dependency()
  } finally {
    if (prev === undefined) delete process.env.LOG_LEVEL
    else process.env.LOG_LEVEL = prev
  }
}

// Short fingerprint of the rendered SVG, used in snapshots so that
// "the same seed always produces the same logo" is checked without storing whole SVGs.
export function svgDigest(image: SvgImage): string {
  return createHash('sha256').update(Svgson.stringify(image.svgNode)).digest('hex').slice(0, 16)
}

export function findNodes(node: Svgson.INode, name: string): Svgson.INode[] {
  const found = node.name === name ? [node] : []
  return found.concat(...node.children.map((child) => findNodes(child, name)))
}
