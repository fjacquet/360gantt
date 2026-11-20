import type { LocationGroup, ParsedAsset } from '@/types/asset'
import { contractStatus } from '@/utils/colors'
import { type Axis, buildAxis } from './axis'

export type RowPlan =
  | { kind: 'group'; label: string }
  | { kind: 'asset'; label: string; asset: ParsedAsset }

export interface LocationSlidePlan {
  title: string
  subtitle: string
  rows: RowPlan[]
}

export interface OverviewRow {
  location: string
  ok: number
  warning: number
  critical: number
  expired: number
  total: number
}

export interface DeckPlan {
  totals: { locations: number; assets: number; underOneYear: number; expired: number }
  overview: OverviewRow[]
  slides: LocationSlidePlan[]
  axis: Axis
}

const MAX_LABEL = 44
const truncate = (s: string) => (s.length > MAX_LABEL ? `${s.slice(0, MAX_LABEL - 1)}…` : s)

export function planDeck(groups: LocationGroup[], rowsPerSlide = 14): DeckPlan {
  if (groups.length === 0) throw new Error('Nothing to export')

  const totals = { locations: groups.length, assets: 0, underOneYear: 0, expired: 0 }
  const overview: OverviewRow[] = []
  const slides: LocationSlidePlan[] = []

  for (const g of groups) {
    const title = [g.locationName, g.city, g.country].filter(Boolean).join(', ')
    const row: OverviewRow = {
      location: title,
      ok: 0,
      warning: 0,
      critical: 0,
      expired: 0,
      total: 0,
    }
    const rows: RowPlan[] = []
    for (const pg of g.productGroups) {
      const n = pg.assets.length
      rows.push({
        kind: 'group',
        label: truncate(n > 1 ? `${pg.productName} (${n})` : pg.productName),
      })
      for (const a of pg.assets) {
        rows.push({ kind: 'asset', label: truncate(a.assetId), asset: a })
        row[contractStatus(a.daysRemaining)]++
        row.total++
      }
    }
    overview.push(row)
    totals.assets += row.total
    totals.underOneYear += row.critical
    totals.expired += row.expired

    const subtitle = `${row.total} assets`
    let page: RowPlan[] = []
    const pages: RowPlan[][] = [page]
    for (const r of rows) {
      // Full page, or a group header that would end up alone at the bottom.
      const orphanHeader = r.kind === 'group' && page.length > 0 && page.length === rowsPerSlide - 1
      if (page.length >= rowsPerSlide || orphanHeader) {
        page = []
        pages.push(page)
      }
      page.push(r)
    }
    for (const [i, p] of pages.entries()) {
      slides.push({ title: i === 0 ? title : `${title} (continued)`, subtitle, rows: p })
    }
  }

  return { totals, overview, slides, axis: buildAxis(groups) }
}
