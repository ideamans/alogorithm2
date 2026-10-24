# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a TypeScript-based logo generator application for ideaman's Inc. It generates dynamic logo marks using geometric patterns and serves them through a Fastify web server. The application creates three types of logos: inline, rectangle, and icon formats, both as SVG and PNG.

## Development Commands

### Building and Running
```bash
# Build the project
npm run build

# Start the server
npm start

# Start with auto-rebuild and run
npm run start
```

### Testing and Quality
```bash
# Run all tests (includes build, lint, prettier, cspell, and unit tests)
npm test

# Run individual test types
npm run test:lint      # ESLint
npm run test:prettier  # Prettier format check
npm run test:cspell    # Spell check
npm run test:unit      # ava tests (build/spec/*.spec.js, compiled from src/spec/*.spec.ts)

# Watch mode for tests
npm run watch

# Regenerate golden fixtures (fixtures/golden/) after an intentional output change
npm run golden:update

# Build the production Docker image, run the tests inside it and hit every endpoint over HTTP
npm run docker:smoke
```

Tests (`src/spec/`): unit tests for svg/text/layout modules, HTTP tests via `fastify.inject`,
a real-server test that spawns `build/start.js`, and golden comparisons (SVG byte-exact,
PNG pixel-wise with tolerance because sharp/libvips/librsvg upgrades may change antialiasing).
Tests must run from the repository root (fonts and fixtures are resolved from cwd).
`npm run build` must run before `test:unit` (the `test` script does this).

### Code Quality
```bash
# Fix all code quality issues
npm run fix

# Individual fixes
npm run fix:lint       # Auto-fix ESLint issues
npm run fix:prettier   # Auto-format with Prettier
```

## Architecture

### Core Components

- **Server** (`src/server.ts`): Fastify-based HTTP server with three main endpoints:
  - `/v2/inline.{svg|png}` - Horizontal logo with text beside mark
  - `/v2/rect.{svg|png}` - Vertical logo with text below mark  
  - `/v2/icon.{svg|png}` - Icon-only version

- **Logo Generation Pipeline**:
  1. `mark.ts` - Creates geometric patterns using Trianglify and clips them with blob shapes
  2. `text.ts` - Handles text rendering and scaling
  3. `inline.ts/rect.ts/icon.ts` - Combines marks and text for specific layouts
  4. `svg.ts` - SVG manipulation utilities

- **Dependency Injection** (`src/dependency.ts`): Centralized configuration and defaults management

### Key Libraries
- **Trianglify**: Geometric pattern generation
- **Blobs**: Organic shape generation for clipping paths
- **Fastify**: Web server framework
- **Sharp**: PNG conversion from SVG
- **Svgson**: SVG parsing and manipulation

### Configuration
All defaults are configurable via environment variables:
- `DEFAULT_SEED`: Pattern seed (default: "alogorithm2")
- `PORT`: Server port (default: 3000)
- `HOST`: Server host (default: "0.0.0.0")
- `LOGO_TEXT`: Company name text
- Various styling and layout parameters

### Logo Generation Process
1. Generate triangular geometric pattern based on seed
2. Create organic blob shape for clipping
3. Combine pattern with clipping path to create logo mark
4. Render and scale company text
5. Compose final layout (inline/rect/icon)
6. Convert to PNG if requested

## Development Notes

- Uses ES modules with TypeScript
- Strict TypeScript configuration with comprehensive type checking
- ESLint with TypeScript rules, import ordering, and sorting
- Prettier for code formatting
- Tests use AVA (`ava` config in package.json, `workerThreads: false` because the native `canvas` module pulled in by trianglify cannot be loaded in multiple worker threads)
- Build outputs to `build/` directory
- Font files stored in `fonts/` directory