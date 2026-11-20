import type { LocationGroup } from '@/types/asset'
import { buildAxis, dateToFraction } from '../axis'

const group = (start: Date, end: Date) =>
  ({ locationStart: start, locationEnd: end }) as LocationGroup

describe('buildAxis', () => {
  it('aligns to Jan 1 and uses quarter ticks for spans <= 3 years', () => {
    const axis = buildAxis([group(new Date(2024, 2, 10), new Date(2026, 5, 1))])
    expect(axis.start).toEqual(new Date(2024, 0, 1))
    expect(axis.end).toEqual(new Date(2027, 0, 1))
    expect(axis.ticks[0]?.label).toBe('Q1 2024')
    expect(axis.ticks).toHaveLength(12)
  })

  it('uses year ticks for longer spans', () => {
    const axis = buildAxis([group(new Date(2020, 4, 1), new Date(2029, 5, 1))])
    expect(axis.ticks[0]?.label).toBe('2020')
    expect(axis.ticks.at(-1)?.label).toBe('2029')
    expect(axis.ticks).toHaveLength(10)
  })

  it('maps start to 0 and end to 1', () => {
    const axis = buildAxis([group(new Date(2024, 2, 10), new Date(2026, 5, 1))])
    expect(dateToFraction(axis.start, axis)).toBe(0)
    expect(dateToFraction(axis.end, axis)).toBe(1)
  })
})
