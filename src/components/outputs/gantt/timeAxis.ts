import type { ZoomScale } from '@store/assetStore'
import type { GanttTask } from '@/types/gantt'

export interface TimeColumn {
  label: string
  x: number
  width: number
}

export interface TimeAxisData {
  topRow: TimeColumn[]
  bottomRow: TimeColumn[]
  totalWidth: number
  startDate: Date
  endDate: Date
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function formatLabel(date: Date, format: string): string {
  if (format === '%Y') return String(date.getFullYear())
  if (format === '%M') return MONTH_NAMES[date.getMonth()] ?? ''
  if (format === '%M %Y') return `${MONTH_NAMES[date.getMonth()] ?? ''} ${date.getFullYear()}`
  if (format === '%j') return String(date.getDate())
  return String(date.getFullYear())
}

/** Linear interpolation: date → pixel x within the chart area */
export function dateToX(date: Date, startDate: Date, endDate: Date, totalWidth: number): number {
  const total = endDate.getTime() - startDate.getTime()
  if (total <= 0) return 0
  const offset = date.getTime() - startDate.getTime()
  return (offset / total) * totalWidth
}

/** Step forward by `step` units of `unit` from `date`, returning a new Date */
function stepDate(date: Date, unit: string, step: number): Date {
  const d = new Date(date)
  if (unit === 'year') {
    d.setFullYear(d.getFullYear() + step)
  } else if (unit === 'month') {
    d.setMonth(d.getMonth() + step)
  } else if (unit === 'day') {
    d.setDate(d.getDate() + step)
  }
  return d
}

/** Align a date to the start of its period */
function alignDate(date: Date, unit: string, step: number): Date {
  const d = new Date(date)
  if (unit === 'year') {
    const year = d.getFullYear()
    d.setFullYear(year - (year % step))
    d.setMonth(0, 1)
    d.setHours(0, 0, 0, 0)
  } else if (unit === 'month') {
    const month = d.getMonth()
    d.setMonth(month - (month % step), 1)
    d.setHours(0, 0, 0, 0)
  } else if (unit === 'day') {
    d.setHours(0, 0, 0, 0)
  }
  return d
}

/**
 * Computes time axis columns from task date ranges and zoom scales.
 * scales[0] = top (coarse), scales[1] = bottom (fine).
 */
export function computeTimeAxis(
  tasks: GanttTask[],
  scales: ZoomScale[],
  cellWidth = 70,
): TimeAxisData {
  if (tasks.length === 0 || scales.length < 2) {
    return { topRow: [], bottomRow: [], totalWidth: 0, startDate: new Date(), endDate: new Date() }
  }

  // Safe: guarded by scales.length < 2 check above
  const topScale = scales[0] as ZoomScale
  const bottomScale = scales[1] as ZoomScale

  // Safe: guarded by tasks.length === 0 check above
  const firstTask = tasks[0] as GanttTask
  let minDate = firstTask.start
  let maxDate = firstTask.end
  for (const task of tasks) {
    if (task.start < minDate) minDate = task.start
    if (task.end > maxDate) maxDate = task.end
  }

  // Pad: align start to the beginning of its coarse period, end to one period after
  const startDate = alignDate(minDate, topScale.unit, topScale.step)
  const endDate = stepDate(alignDate(maxDate, topScale.unit, topScale.step), topScale.unit, topScale.step)

  // Build bottom row columns
  const bottomRow: TimeColumn[] = []
  let cursor = alignDate(startDate, bottomScale.unit, bottomScale.step)
  while (cursor < endDate) {
    const next = stepDate(cursor, bottomScale.unit, bottomScale.step)
    bottomRow.push({
      label: formatLabel(cursor, bottomScale.format),
      x: 0, // will be set below
      width: cellWidth,
    })
    cursor = next
  }

  // Assign x positions
  const totalWidth = bottomRow.length * cellWidth
  for (let i = 0; i < bottomRow.length; i++) {
    const col = bottomRow[i]
    if (col) col.x = i * cellWidth
  }

  // Build top row by grouping bottom columns
  const topRow: TimeColumn[] = []
  cursor = alignDate(startDate, topScale.unit, topScale.step)
  let bottomIdx = 0
  let bottomCursor = alignDate(startDate, bottomScale.unit, bottomScale.step)

  while (cursor < endDate) {
    const nextTop = stepDate(cursor, topScale.unit, topScale.step)
    const groupStart = bottomIdx
    // Count how many bottom columns fall within this top period
    while (bottomCursor < nextTop && bottomIdx < bottomRow.length) {
      bottomCursor = stepDate(bottomCursor, bottomScale.unit, bottomScale.step)
      bottomIdx++
    }
    const groupCount = bottomIdx - groupStart
    if (groupCount > 0) {
      topRow.push({
        label: formatLabel(cursor, topScale.format),
        x: groupStart * cellWidth,
        width: groupCount * cellWidth,
      })
    }
    cursor = nextTop
  }

  return { topRow, bottomRow, totalWidth, startDate, endDate }
}
