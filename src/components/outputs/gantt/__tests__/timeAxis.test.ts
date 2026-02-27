import { describe, expect, it } from 'vitest'
import { computeTimeAxis, dateToX, formatLabel } from '../timeAxis'
import type { GanttTask } from '@/types/gantt'
import type { ZoomScale } from '@store/assetStore'

const yearScales: ZoomScale[] = [
  { unit: 'year', step: 1, format: '%Y' },
  { unit: 'month', step: 6, format: '%M' },
]

const fiveYearScales: ZoomScale[] = [
  { unit: 'year', step: 5, format: '%Y' },
  { unit: 'year', step: 1, format: '%Y' },
]

function task(start: string, end: string): GanttTask {
  return {
    id: 1,
    text: 'Test',
    start: new Date(start),
    end: new Date(end),
    type: 'task',
  }
}

describe('formatLabel', () => {
  it('formats year', () => {
    expect(formatLabel(new Date('2025-06-15'), '%Y')).toBe('2025')
  })

  it('formats month name', () => {
    expect(formatLabel(new Date('2025-01-15'), '%M')).toBe('Jan')
    expect(formatLabel(new Date('2025-12-15'), '%M')).toBe('Dec')
  })

  it('formats month + year', () => {
    expect(formatLabel(new Date('2025-03-15'), '%M %Y')).toBe('Mar 2025')
  })

  it('formats day', () => {
    expect(formatLabel(new Date('2025-06-07'), '%j')).toBe('7')
  })
})

describe('dateToX', () => {
  const start = new Date('2020-01-01')
  const end = new Date('2025-01-01')

  it('returns 0 for start date', () => {
    expect(dateToX(start, start, end, 1000)).toBe(0)
  })

  it('returns totalWidth for end date', () => {
    expect(dateToX(end, start, end, 1000)).toBe(1000)
  })

  it('returns proportional value for midpoint', () => {
    const mid = new Date('2022-07-02')
    const x = dateToX(mid, start, end, 1000)
    expect(x).toBeGreaterThan(400)
    expect(x).toBeLessThan(600)
  })

  it('returns 0 when start === end', () => {
    expect(dateToX(start, start, start, 1000)).toBe(0)
  })
})

describe('computeTimeAxis', () => {
  it('returns empty for no tasks', () => {
    const result = computeTimeAxis([], yearScales)
    expect(result.topRow).toHaveLength(0)
    expect(result.bottomRow).toHaveLength(0)
    expect(result.totalWidth).toBe(0)
  })

  it('returns empty when scales has fewer than 2 entries', () => {
    const result = computeTimeAxis([task('2024-01-01', '2025-01-01')], [yearScales[0] as ZoomScale])
    expect(result.totalWidth).toBe(0)
  })

  it('produces bottom columns for year scale', () => {
    const tasks = [task('2024-03-01', '2026-09-01')]
    const result = computeTimeAxis(tasks, yearScales)
    // Bottom is 6-month intervals. From 2024 to ~2027 = at least 6 columns
    expect(result.bottomRow.length).toBeGreaterThanOrEqual(6)
    expect(result.totalWidth).toBe(result.bottomRow.length * 70)
  })

  it('produces bottom columns for 5-year scale', () => {
    const tasks = [task('2020-01-01', '2028-12-01')]
    const result = computeTimeAxis(tasks, fiveYearScales)
    // Bottom is yearly intervals. From 2020 to ~2030 = at least 10 columns
    expect(result.bottomRow.length).toBeGreaterThanOrEqual(10)
  })

  it('top row groups bottom columns', () => {
    const tasks = [task('2024-03-01', '2026-09-01')]
    const result = computeTimeAxis(tasks, yearScales)
    // Each top column should span 2 bottom columns (12 months / 6 months)
    for (const col of result.topRow) {
      expect(col.width).toBe(140) // 2 * 70
    }
  })

  it('totalWidth equals bottomRow.length * cellWidth', () => {
    const tasks = [task('2024-01-01', '2025-06-01')]
    const result = computeTimeAxis(tasks, yearScales, 80)
    expect(result.totalWidth).toBe(result.bottomRow.length * 80)
  })

  it('uses custom cellWidth', () => {
    const tasks = [task('2024-01-01', '2025-01-01')]
    const result = computeTimeAxis(tasks, yearScales, 100)
    for (const col of result.bottomRow) {
      expect(col.width).toBe(100)
    }
  })
})
