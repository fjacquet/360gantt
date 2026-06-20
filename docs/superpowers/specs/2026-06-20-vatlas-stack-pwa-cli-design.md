# 360gantt → vAtlas stack + ci release · PWA + CLI

**Date:** 2026-06-20
**Status:** Approved design (pre-plan)
**Branch:** `feat/vatlas-stack-pwa-cli`

## Context

360gantt is a client-side React app that turns a Dell asset-export CSV into an
interactive, exportable Gantt chart. It already runs ~90% of the stack used by
the sibling project [`vatlas`](../../../../vatlas) — React 19, Vite, TypeScript
(strict), Biome, Zustand, Tailwind 4, Zod, i18next, Vitest — and already consumes
the central [`fjacquet/ci@v1`](../../../../ci) reusable workflows
(`web-ci`, `web-deploy`, `web-release`, `web-security`).

Two capabilities vAtlas has (or that the maintainer now wants) are still missing:

- **PWA** — vAtlas is an installable, offline-capable, privacy-first PWA
  (`vite-plugin-pwa` `injectManifest`, a hand-written precache-only service
  worker, a fetch guard that never caches user data, prompt-to-update). 360gantt
  has none of this.
- **CLI** — neither project has one yet. The maintainer wants 360gantt to render
  Gantt exports **headlessly** (no browser), so the same chart can be produced in
  scripts/CI from a CSV.

This change brings 360gantt to full parity with the vAtlas stack, adds the PWA and
the CLI, and wires both into the existing `ci@v1` release path — delivered as one
coordinated change.

## Goals

1. Ship a **privacy-first PWA** that mirrors vAtlas: installable, offline app-shell,
   never caches the user's CSV/asset data, prompt-to-update.
2. Add a **headless export CLI** that reuses the existing pure engines and the
   `SvgGantt` component to render `pdf`/`pptx`/`png`/`svg`/`mmd` with no browser.
3. **Wire both into `ci@v1`**: the PWA ships through the existing `web-deploy`;
   the CLI publishes through `web-release` (`publish-npm`).
4. Close remaining vAtlas-stack gaps (supply-chain check, version parity) where
   low-risk.

## Non-goals

- No monorepo / workspace restructuring (see rejected approach B).
- No headless-browser rendering (rejected approach C).
- No publish to npmjs.org in this change (GitHub Packages only, per `ci@v1`).
- No new chart features, no changes to the CSV format or the existing engines'
  behavior (only a pure extraction — see Architecture).
- No persistence of user data offline (confirmed: "mirror vAtlas exactly").

## Approach decision

**Chosen — A: single package, shared React→SVG renderer, Vite-built CLI.**
Reuse `SvgGantt` via `react-dom/server` `renderToStaticMarkup` → SVG string →
`@resvg/resvg-wasm` → PNG → `jsPDF`/`pptxgenjs`. The CLI is built with a second
Vite SSR config. Maximum code reuse (zero rendering drift web↔CLI), minimal new
tooling, one `package.json`.

Rejected:

- **B — npm workspaces monorepo** (`core`/`web`/`cli`). Cleaner isolation but a
  large file move and more config; overkill for a single-maintainer repo (YAGNI).
- **C — headless-browser CLI (Playwright/puppeteer).** Reuses the browser export
  path but adds a huge, slow, fragile dependency and breaks `npm i -g`.

## Architecture — extract a shared, browser-free core

The CSV pipeline currently lives inside the `useCsvParse` **hook**
(`src/hooks/useCsvParse.ts`), which is browser-bound (PapaParse over a `File`,
`sonner` toasts, the Zustand store). The pure transformation is extracted so both
web and CLI call one function — a targeted improvement, not a rewrite.

- **New `src/engines/csv/pipeline.ts`**
  `parseCsvToGantt(csvText: string): { ganttData, locationGroups, totalAssets }`.
  Runs the exact sequence from `useCsvParse.ts` lines 21–34:
  `resolveHeaders → toRawAsset → filterAssets → groupAssets → toGanttData`.
  Throws on no-recognised-headers / no-matching-assets (the caller maps to UI/CLI
  errors). Pure, no React, no DOM, fully unit-testable.
- **`useCsvParse` becomes a thin browser wrapper**: PapaParse (`File`) →
  `parseCsvToGantt(text)` → store + toasts. No behavior change for the app.

Confirmed browser-free building blocks the CLI reuses as-is:

- `src/engines/csv/*` — all five engine functions (pure).
- `src/store/assetStore.ts` — exports `ZOOM_PRESETS` and the `ZoomScale` type
  (module instantiates a Zustand store at import, which is harmless under Node;
  optionally these constants can be relocated to a constants module for purity —
  not required).
- `src/components/outputs/gantt/SvgGantt.tsx` — pure React, props
  `{ tasks, scales, dark }`, returns `<svg>`; depends only on `computeTimeAxis` /
  `dateToX` from `timeAxis.ts` (standard JS).

## CLI design (`src/cli/`)

- **`index.ts`** — `commander` entry, shebang `#!/usr/bin/env node`, exposed as
  `bin: { "360gantt": "./dist-cli/index.js" }`.
  Usage:
  `360gantt <input.csv> -o <out.{pdf,pptx,png,svg,mmd}> [--zoom <year|5-year>] [--dark] [--scale <n>]`.
  Output format is inferred from the `-o` extension. Non-zero exit + stderr
  message on parse/usage errors.
- **`render.ts`** — `renderToStaticMarkup(createElement(SvgGantt, { tasks, scales, dark }))`
  → SVG string. `scales` selected from `ZOOM_PRESETS[idx].scales` (default index 1,
  "Year", matching the app default).
- **`rasterize.ts`** — SVG string → PNG `Uint8Array` via `@resvg/resvg-wasm`.
  `initWasm()` runs once (wasm read from the installed package). **Bundle an
  Inter/Roboto TTF and register it via resvg `font.fontBuffers`** so text renders
  in headless/CI environments (see Risks).
- **`exporters.ts`** — given the SVG and/or PNG:
  - `svg` — write the SVG string.
  - `png` — write the PNG buffer.
  - `pdf` — `jsPDF`, single page sized to the image (mirrors the
    `pageH <= visibleH*1.1` branch in `src/hooks/useExport.ts:83-90`). Pagination
    is a browser-only nicety and is out of scope for the CLI (single full-size page).
  - `pptx` — `pptxgenjs`, one image slide sized to content (mirrors
    `useExport.ts:122-143`).
  - `mmd` — reuse the pure Mermaid string builder logic currently inline in
    `useExport.exportMermaid`, extracted to **`src/engines/csv/mermaid.ts`**
    (`toMermaid(tasks): string`) so both the app and CLI call one pure function.

The browser `useExport` hook stays as-is (its canvas/`Image`/`document` path is
correct for the live app).

## PWA design (mirror vAtlas)

- **`vite-plugin-pwa`** with `strategy: 'injectManifest'`, `srcDir: 'src'`,
  `filename: 'sw.ts'`, `devOptions.enabled: false` (disabled in `vite dev`).
- **`src/sw.ts`** — workbox precache-only service worker, prompt-style activation
  (the user controls when a new version activates).
- **`src/privacy/fetchGuard.ts`** — never cache cross-origin/opaque responses or
  any user data; only build-time precached assets are served offline.
- **`src/pwa/registerSW.ts`** — manual SW registration with a "new version
  available — reload" prompt surfaced through the existing `sonner` toast.
  Imported from `src/main.tsx`.
- **Manifest** (declared in `vite.config.ts`): `display: 'standalone'`, theme/
  background colors matching the Dell-blue palette, and `scope` / `start_url` /
  `id` **derived from `VITE_BASE`** so both GitHub Pages (`/360gantt/`) and Docker
  (`/`) produce a correct manifest.
- **Icons**: keep existing `public/favicon.svg`; generate `pwa-192.png`,
  `pwa-512.png`, `pwa-maskable-512.png` from `public/logo.svg` (one-time, via a
  small script using the same resvg dependency).

## Stack alignment & dependencies

- **Add (runtime/dev):** `vite-plugin-pwa`, `@resvg/resvg-wasm`, `commander`,
  plus `workbox-*` as required by `injectManifest`. All match or extend the vAtlas
  stack.
- **Optional, low-risk parity** (only if `make ci` stays green): Vite 7 → 8,
  Biome → 2.4.x; port vAtlas's `scripts/check-supply-chain.mjs`.
- **Path aliases:** already present in `vite.config.ts` and `tsconfig.app.json` —
  no change.

## CI / release wiring

- **`.github/workflows/deploy.yml`** — unchanged. `web-deploy@v1` builds the web
  app to `dist/`; the PWA's `sw.js` + `manifest.webmanifest` + icons are emitted
  into `dist/` by `vite-plugin-pwa` and ship automatically.
- **`.github/workflows/release.yml`** — flip `publish-npm: false → true` so
  `web-release@v1` publishes the CLI to **GitHub Packages** on a `v*` tag. Keep
  `publish-docker: true`.
- **`package.json`**:
  - `name` → `@fjacquet/360gantt` (scope required by GitHub Packages).
  - `private: false`; add `publishConfig.registry` for `npm.pkg.github.com`.
  - `bin: { "360gantt": "./dist-cli/index.js" }`.
  - `files: ["dist-cli"]` (publish only the CLI; the web `dist/` is deployed
    separately and excluded from the npm tarball).
  - Scripts: `"build:cli": "vite build -c vite.cli.config.ts"`,
    `"prepack": "npm run build:cli"` (guarantees `dist-cli/` exists at publish time
    regardless of the workflow). `build` stays web-only so `web-ci` / `web-deploy`
    are unaffected.
- **`vite.cli.config.ts`** — new Vite SSR/library build → `dist-cli/index.js`
  (ESM, shebang banner preserved), Node built-ins and heavy deps externalized.

## Testing strategy

- **Unit (Vitest, ≥75% coverage on new pure modules):**
  - `parseCsvToGantt` — against a fixture CSV (happy path + no-headers + no-matches).
  - `cli/render` — asserts the SVG string contains expected structure (header,
    bars, today line) for a fixture.
  - `cli/rasterize` — produces a non-empty PNG of the expected dimensions.
  - `cli/exporters` — writes each format; files exist and are non-trivial in size.
  - The extracted Mermaid helper — output matches the current app behavior.
- **Integration:** run the built CLI (`dist-cli/index.js`) against a fixture CSV,
  assert each output format is produced.
- **PWA:** assert the production build emits `sw.js` and `manifest.webmanifest`
  with `scope`/`start_url` derived from `VITE_BASE` (build-time check).

## File-level change map

```
src/engines/csv/pipeline.ts            NEW   pure CSV→GanttData pipeline
src/hooks/useCsvParse.ts               EDIT  thin wrapper over parseCsvToGantt
src/cli/index.ts                       NEW   commander entry + bin
src/cli/render.ts                      NEW   SvgGantt → SVG string (SSR)
src/cli/rasterize.ts                   NEW   SVG → PNG (@resvg/resvg-wasm)
src/cli/exporters.ts                   NEW   pdf/pptx/png/svg/mmd writers
src/engines/csv/mermaid.ts             NEW   extracted pure toMermaid(tasks)
src/hooks/useExport.ts                 EDIT  use shared toMermaid helper
src/sw.ts                              NEW   injectManifest service worker
src/privacy/fetchGuard.ts              NEW   privacy fetch guard
src/pwa/registerSW.ts                  NEW   SW registration + update prompt
src/main.tsx                           EDIT  import registerSW
vite.config.ts                         EDIT  VitePWA plugin + manifest
vite.cli.config.ts                     NEW   Node/SSR build for the CLI
package.json                           EDIT  name/bin/files/scripts/publishConfig
public/pwa-192.png|pwa-512.png|        NEW   PWA icons (generated from logo.svg)
  pwa-maskable-512.png
.github/workflows/release.yml          EDIT  publish-npm: true
scripts/check-supply-chain.mjs         NEW   (optional) vAtlas parity
docs/superpowers/specs/...-design.md   NEW   this document
```

## Verification

End-to-end checks after implementation:

1. `make ci` — typecheck + lint + coverage (≥75%) + build all green.
2. **CLI:** `node dist-cli/index.js src/data/<fixture>.csv -o /tmp/out.pdf` (and
   `.pptx`, `.png`, `.svg`, `.mmd`) — each file is produced and opens correctly;
   text labels are visible (font registration works).
3. **PWA:** `make preview`, open in Chrome → Lighthouse PWA audit passes;
   "Install" is offered; reload offline still serves the app shell; confirm via
   DevTools → Application that no CSV/asset data is cached.
4. **Privacy:** load a CSV, then inspect Cache Storage — only build assets present.
5. **Release dry-run:** confirm `npm pack` includes only `dist-cli/` and that
   `bin` resolves; confirm `release.yml` with `publish-npm: true` targets GitHub
   Packages under the `@fjacquet` scope.

## Key risks & decisions

- **Font rendering in resvg (main technical risk).** `SvgGantt` uses
  `Inter, system-ui`; headless/CI containers lack these fonts, so text could fail
  to render. *Mitigation:* bundle a TTF (Inter or Roboto) and register it with
  resvg `font.fontBuffers`; verify in CI, not just locally.
- **GitHub Packages install friction.** Consumers need a scoped `.npmrc` + token.
  Accepted per "use ci release"; npmjs.org would require a separate OIDC publish
  workflow (noted, not built).
- **Single `package.json` double-duty (web + CLI).** Contained via `files`
  (publish only `dist-cli/`) and `prepack` (build CLI at publish time). `build`
  remains web-only.
- **Vite 7 → 8 bump.** Optional; only adopt if `make ci` stays green, otherwise
  defer.
