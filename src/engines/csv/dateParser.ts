/**
 * Date parsers for Dell asset CSV formats.
 *
 * Two formats appear in the wild:
 *  1. Contract dates  → "July 23, 2026" / "February 04, 2026"
 *  2. Install base age → "4yr, 3mo, 1d" (relative to today)
 */

const MONTH_MAP: Record<string, number> = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
}

/**
 * Parses a date string like "July 23, 2026" or "February 04, 2026".
 * Returns null for empty / "Unavailable" / unrecognised strings.
 */
export function parseContractDate(raw: string): Date | null {
  const trimmed = raw.trim()
  if (!trimmed || trimmed.toLowerCase() === 'unavailable') return null

  // Match "MonthName D?, YYYY"
  const match = trimmed.match(/^(\w+)\s+(\d{1,2}),\s*(\d{4})$/)
  if (!match) return null

  const [, monthStr, dayStr, yearStr] = match
  const month = MONTH_MAP[monthStr.toLowerCase()]
  if (month === undefined) return null

  const day = parseInt(dayStr, 10)
  const year = parseInt(yearStr, 10)

  const d = new Date(year, month, day)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Parses an age string like "4yr, 3mo, 1d" and returns the
 * estimated install date by subtracting from today.
 * Returns null for empty / unrecognised strings.
 */
export function parseInstallBaseAge(raw: string, today = new Date()): Date | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  let years = 0
  let months = 0
  let days = 0

  const yrMatch = trimmed.match(/(\d+)\s*yr/)
  const moMatch = trimmed.match(/(\d+)\s*mo/)
  const dMatch = trimmed.match(/(\d+)\s*d/)

  if (yrMatch?.[1]) years = parseInt(yrMatch[1], 10)
  if (moMatch?.[1]) months = parseInt(moMatch[1], 10)
  if (dMatch?.[1]) days = parseInt(dMatch[1], 10)

  if (years === 0 && months === 0 && days === 0) return null

  const install = new Date(today)
  install.setFullYear(install.getFullYear() - years)
  install.setMonth(install.getMonth() - months)
  install.setDate(install.getDate() - days)

  return install
}
