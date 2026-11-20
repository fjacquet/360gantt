import type { LocationGroup } from '@/types/asset'

export interface Axis {
  start: Date
  end: Date
  ticks: { label: string; date: Date }[]
}

export function buildAxis(groups: LocationGroup[]): Axis {
  const min = Math.min(...groups.map((g) => g.locationStart.getTime()))
  const max = Math.max(...groups.map((g) => g.locationEnd.getTime()))
  const startYear = new Date(min).getFullYear()
  const maxDate = new Date(max)
  const maxYear = maxDate.getFullYear()
  // Round up to the next Jan 1; a date already on Jan 1 stays put.
  const endYear = Math.max(
    startYear + 1, // keep a non-empty axis when every date is a lone Jan 1
    maxDate.getTime() === new Date(maxYear, 0, 1).getTime() ? maxYear : maxYear + 1,
  )

  const quarters = endYear - startYear <= 3
  const ticks: Axis['ticks'] = []
  for (let y = startYear; y < endYear; y++) {
    if (quarters) {
      for (let q = 0; q < 4; q++) ticks.push({ label: `Q${q + 1} ${y}`, date: new Date(y, q * 3, 1) })
    } else {
      ticks.push({ label: String(y), date: new Date(y, 0, 1) })
    }
  }
  return { start: new Date(startYear, 0, 1), end: new Date(endYear, 0, 1), ticks }
}

/** Position of `date` on the axis, 0 at start and 1 at end; not clamped. */
export function dateToFraction(date: Date, axis: Axis): number {
  const s = axis.start.getTime()
  return (date.getTime() - s) / (axis.end.getTime() - s)
}
