# 360gantt — Asset Lifecycle Visualizer

> Visualize Dell asset contract timelines as an interactive Gantt chart.
> Drop a Dell asset export CSV → get a color-coded, filterable, exportable Gantt in seconds.

[![CI](https://github.com/fjacquet/360gantt/actions/workflows/ci.yml/badge.svg)](https://github.com/fjacquet/360gantt/actions/workflows/ci.yml)
[![Deploy](https://github.com/fjacquet/360gantt/actions/workflows/static.yml/badge.svg)](https://github.com/fjacquet/360gantt/actions/workflows/static.yml)
[![Release](https://github.com/fjacquet/360gantt/actions/workflows/release.yml/badge.svg)](https://github.com/fjacquet/360gantt/actions/workflows/release.yml)

**Live demo:** https://fjacquet.github.io/360gantt/

---

## Features

- **Drag-and-drop CSV import** — supports Dell asset exports in English, French, Italian, and German
- **3-level hierarchy** — Location → Product family → Individual asset
- **Contract status color coding**
  - 🟢 Green — contract ends in 2+ years
  - 🟡 Amber — 1–2 years remaining
  - 🔴 Red — less than 1 year remaining
  - ⬜ Gray — already expired
- **Time-axis zoom** — 5-year / Year / Quarter / Month views
- **Visual scale** — 50 % to 200 % canvas zoom (reflected in exports)
- **Filter by location** and free-text product search
- **Export to PDF** — custom page size, multi-page for tall charts
- **Export to PPTX** — full-resolution image slide, sized to content
- **Dark mode** — auto-detected from browser preference
- **i18n** — English and French UI, toggle in header
- **Fully client-side** — no server, no data upload, runs in the browser

---

## CSV Format

Drop any **Dell TechDirect / Asset Management** export. The app auto-detects column names in EN / FR / IT / DE.

Required columns (any supported language):

| Canonical name | Example EN header | Example FR header |
|---|---|---|
| Asset ID | `ASSET ID` | `ID D'ACTIF` |
| Product Name | `PRODUCT NAME` | `NOM DU PRODUIT` |
| Product Type | `PRODUCT TYPE` | `TYPE DE PRODUIT` |
| Services Status | `SERVICES STATUS` | `STATUT DES SERVICES` |
| Contract End Date | `CONTRACT END DATE` | `DATE DE FIN DU CONTRAT` |
| Location ID | `LOCATION ID` | `ID D'EMPLACEMENT` |
| Location Name | `LOCATION NAME` | `NOM DE L'EMPLACEMENT` |

Only rows where `PRODUCT TYPE = HARDWARE` and `SERVICES STATUS = Active` with a valid contract end date are shown.

---

## Getting Started

### Browser (GitHub Pages)

Open https://fjacquet.github.io/360gantt/ — no installation required.

### Docker

```bash
docker run -p 8080:80 ghcr.io/fjacquet/360gantt:latest
```

Then open http://localhost:8080.

### Local development

```bash
git clone https://github.com/fjacquet/360gantt.git
cd 360gantt
make install
make dev          # http://localhost:5173/360gantt/
```

---

## Make targets

```
make install        Install dependencies (npm ci)
make dev            Start dev server
make build          Production build
make preview        Build then serve locally

make typecheck      TypeScript type check
make lint           Biome lint
make lint-fix       Biome lint with auto-fix
make format         Biome format

make test           Run tests (watch)
make test-coverage  Run tests with coverage
make ci             Full CI check locally

make clean          Remove dist + Vite cache
```

---

## Architecture

```
src/
├── engines/csv/          # Pure CSV pipeline (fully unit-tested)
│   ├── headerResolver    # EN/FR/IT/DE column alias normalisation
│   ├── dateParser        # "July 23, 2026" and "4yr, 3mo, 1d" → Date
│   ├── assetFilter       # HARDWARE + Active + has contract date
│   ├── assetGrouper      # Group by location → product, sort by expiry
│   └── svarAdapter       # Domain model → SVAR Gantt task array
├── components/
│   ├── layout/           # Header, AppShell
│   ├── inputs/           # CsvDropzone, FilterPanel
│   └── outputs/          # GanttPanel, EmptyState
├── hooks/
│   ├── useCsvParse       # PapaParse + engines → Zustand store
│   └── useExport         # html2canvas → jsPDF / PptxGenJS
├── store/
│   └── assetStore        # Zustand: gantt data, filters, zoom, scale
└── i18n/                 # EN + FR translations
```

**Stack:** React 19 · Vite 7 · TypeScript (strict) · Tailwind CSS 4 · Zustand · Biome · Vitest · SVAR React Gantt

---

## Docker (self-hosted)

The Docker image is a multi-stage build: Node 22 Alpine to build, nginx Alpine to serve.

```bash
# Pull a specific version
docker pull ghcr.io/fjacquet/360gantt:1.0.0

# Build locally
docker build -t 360gantt .
docker run -p 8080:80 360gantt
```

For Docker Compose:

```yaml
services:
  360gantt:
    image: ghcr.io/fjacquet/360gantt:latest
    ports:
      - "8080:80"
    restart: unless-stopped
```

---

## Releasing

Releases are created automatically when a `v*` tag is pushed:

```bash
git tag v1.0.0
git push origin v1.0.0
```

This triggers:
1. GitHub Release with auto-generated release notes
2. Docker image built and pushed to `ghcr.io/fjacquet/360gantt` with version tags

---

## License

MIT
