# Native PPTX export — design

Date: 2026-11-20 · Status: draft, awaiting approval

## Intent and why

The PPTX export is handed to a **partner** who reads it without the author present. Today it is one slide holding a rasterised PNG of the whole chart (`useExport.ts` `exportPptx`, `src/cli/exporters.ts` `writePptx`): not editable, unreadable on big estates, and visually unlike the sibling projects (vsizer, vatlas, spec-search). It should look like a finished deck, built from native PowerPoint shapes, in the same "Midnight Executive" house style as those three projects.

## Goals

- Deck of native shapes (bars, text, table), no screenshot of the chart.
- Same visual language as vsizer: widescreen 13.333×7.5 in, Calibri, navy/gold/ice palette, navy title slide with gold strip and eyebrow tag.
- Same content as today's chart: location → product group → asset bars, status colours, legend, current filters honoured.
- One builder shared by the browser export and the `360gantt` CLI, so they cannot diverge.

## Non-goals

- Re-theming the web app (`contractStatusColor`, `STATUS_COLORS` stay Dell blue).
- Editorial text, recommendations, taglines (vsizer ADR-0003: factual only, safe to hand to a partner).
- A new dependency. Stay on `pptxgenjs ^4.0.1` (all three sibling projects use it; no "plus" variant exists in the family).
- Other exports (PDF, PNG, SVG, Mermaid) unchanged.

## Anti-goals

- A deck that looks like a pasted screenshot with a title.
- Browser and CLI producing different decks.

## Constraints

- Coverage gate: `src/engines/**` is held to ≥75 %; the builder lives there and needs tests.
- Palette hex without `#` (pptxgenjs convention), as in vsizer `theme.ts`.
- Strings: the app has no i18n; English only, kept in one strings object so it can be translated later.

## Approaches considered

1. **vsizer-style engine (chosen).** `src/engines/export/pptx/` with theme, title slide, overview slide, one slide per location; bars as rectangles. Most work, editable, matches siblings.
2. One native slide per location, no title/overview. Less work, less polished.
3. Keep the picture, add a title slide. Quickest, bars stay a picture.

## Design

**Palette (federated).** Shared `THEME` from vsizer: navy `1E2761`, ice `CADCFC`, gold `F9B935`, darkText `21295C`, grey `6B7291`, lightBg `F5F7FC`, green `2E8B57`, orange `E07B00`, red `C0392B`. Bar colour by contract status: ok → green, warning → orange, critical → red, expired → grey. Uses `contractStatus(daysRemaining)`; only the colour table is new. (Proposal, my call.)

**Slides.**
1. Title: full navy, gold strip at y=6.75, eyebrow, title, subtitle (source file name · date), KPI tiles (locations, assets, expiring < 1 year, expired).
2. Overview: table, one row per location with counts per status bucket.
3+. One slide per location: header, time axis (years/quarters derived from the existing time-axis helper `computeTimeAxis`), a row per product group with one bar per asset, today line, legend. A location with more rows than fit is continued on a following slide.

**Structure.** `buildPptx(input): Promise<ArrayBuffer>` (as vsizer). Input is the already filtered `LocationGroup[]` plus metadata, so it is pure and unit-testable. Browser hook and CLI both call it. Pipeline unchanged.

## Decided by the human

- Native bars, same visual as vsizer/vatlas/spec-search; palette shared with them.
- Audience: partner reading without the speaker.

## My calls (please check)

- Web app colours untouched.
- Status → green/orange/red/grey mapping above.
- English-only strings; no i18n.
- Overview slide included; rows-per-slide limit and continuation left to the builder.
- Browser export honours the active filters (as the chart does today).

## Left to the builder

Row height and rows-per-slide limit; axis granularity per slide (quarters vs years by span); exact KPI tile set; file naming; whether the CLI keeps its `.pptx` flag unchanged.
