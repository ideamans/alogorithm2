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
npm run test:unit      # Unit tests (AVA) with c8 coverage
npm run golden:update  # Regenerate fixtures/golden/* after an intended output change
npm run docker:smoke   # Build the production image, run ava inside it, then hit every endpoint

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
  - `/v2/icon.{svg|png}` - Icon-only version; `circle=1` clips to a circle, `square=1` to a square with `radius` (ratio of the shorter side, 0–0.5) as corner radius (`applyCircleClipping` / `applySquareClipping` in `svg.ts`)

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
- `DEFAULT_SEED`: Pattern seed (default: "alogorithm2"). May contain seed variables
- `TZ`: Standard time zone variable, also used to expand seed variables (default when unset: "Asia/Tokyo")
- `PORT`: Server port (default: 3000)
- `HOST`: Server host (default: "0.0.0.0")
- `LOGO_TEXT`: Company name text
- Various styling and layout parameters

### Seed Variables
`src/seed.ts` expands `{name}` placeholders in the seed before generation (`resolveSeed` in `server.ts`).
- `{today}` → `YYYYMMDD` in the time zone from the `tz` query param, else `TZ`, else `Asia/Tokyo`
- Unknown variables are left untouched; an invalid `tz` returns 400
- The expanded value is what goes into the SVG `<title>` and the PNG `Seed` tEXt chunk
- To add a variable, add an entry to the `variables` map in `expandSeedVariables`

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
- Unit tests: AVA, `src/*.spec.ts`. They run from the compiled `build/**/*.spec.js`, so build first (`npm test` does)
  - `spec-helper.ts` has `createTestDependency()` (real defaults, silent logger), `svgDigest()` and `findNodes()`
  - Server tests use Fastify `inject` (no port)
  - Snapshots in `src/snapshots/` hold SVG digests per seed. They guard "the same seed always draws the same logo";
    a failure after a dependency upgrade means logos changed. Update only on purpose: `npx ava --update-snapshots`
- Requires Node 24 (Dockerfile pins `node:24.22.2`). `canvas` is forced to 3.x via `resolutions` because trianglify
  pulls canvas 2, which does not build on Node 24. Only `toSVG()` is used, so canvas never affects the output
- Tests also live in `src/spec/` (HTTP over `fastify.inject`, golden files in `fixtures/golden/`: SVG byte-equal,
  PNG pixel-compared with a small tolerance). AVA runs with `workerThreads: false` because native modules
  (canvas / sharp) misbehave when loaded in several worker threads
- Build outputs to `build/` directory
- Font files stored in `fonts/` directory

### Dependency notes
- sharp 0.35 requires Node.js >= 20.9.0. PNG output is pinned by `fixtures/golden/*.png` (pixel compare).
