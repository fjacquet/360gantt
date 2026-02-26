import { describe, expect, it } from 'vitest'
import { parseContractDate, parseInstallBaseAge } from '../dateParser'

describe('parseContractDate', () => {
  it('parses full month name', () => {
    const d = parseContractDate('July 23, 2026')
    expect(d).not.toBeNull()
    expect(d?.getFullYear()).toBe(2026)
    expect(d?.getMonth()).toBe(6) // July = 6
    expect(d?.getDate()).toBe(23)
  })

  it('parses zero-padded day', () => {
    const d = parseContractDate('February 04, 2026')
    expect(d?.getMonth()).toBe(1)
    expect(d?.getDate()).toBe(4)
  })

  it('parses single-digit day', () => {
    const d = parseContractDate('March 5, 2025')
    expect(d?.getDate()).toBe(5)
  })

  it('returns null for empty string', () => {
    expect(parseContractDate('')).toBeNull()
  })

  it('returns null for Unavailable', () => {
    expect(parseContractDate('Unavailable')).toBeNull()
    expect(parseContractDate('unavailable')).toBeNull()
  })

  it('returns null for unrecognised format', () => {
    expect(parseContractDate('2026-07-23')).toBeNull()
  })
})

describe('parseInstallBaseAge', () => {
  const today = new Date(2025, 0, 1) // 2025-01-01 as fixed reference

  it('parses full age string', () => {
    const d = parseInstallBaseAge('4yr, 3mo, 1d', today)
    expect(d).not.toBeNull()
    // 2025-01-01 minus 4yr = 2021-01-01, minus 3mo = 2020-10-01, minus 1d = 2020-09-30
    expect(d?.getFullYear()).toBe(2020)
    expect(d?.getMonth()).toBe(8) // September = 8
    expect(d?.getDate()).toBe(30)
  })

  it('parses years only', () => {
    const d = parseInstallBaseAge('2yr', today)
    expect(d?.getFullYear()).toBe(2023)
  })

  it('parses months only', () => {
    const d = parseInstallBaseAge('6mo', today)
    expect(d?.getMonth()).toBe(6) // July = 6
  })

  it('returns null for empty string', () => {
    expect(parseInstallBaseAge('')).toBeNull()
  })

  it('returns null for all-zero age', () => {
    expect(parseInstallBaseAge('0yr, 0mo, 0d', today)).toBeNull()
  })
})
