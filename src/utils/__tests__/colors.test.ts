import { describe, expect, it } from 'vitest'
import { contractStatusColor, contractStatus, STATUS_COLORS } from '../colors'

describe('contractStatusColor', () => {
  it('returns gray for expired contracts', () => {
    expect(contractStatusColor(-1)).toBe('#9ca3af')
    expect(contractStatusColor(-100)).toBe('#9ca3af')
  })

  it('returns red for < 1 year remaining', () => {
    expect(contractStatusColor(0)).toBe('#ef4444')
    expect(contractStatusColor(364)).toBe('#ef4444')
  })

  it('returns amber for 1-2 years remaining', () => {
    expect(contractStatusColor(365)).toBe('#f59e0b')
    expect(contractStatusColor(729)).toBe('#f59e0b')
  })

  it('returns green for > 2 years remaining', () => {
    expect(contractStatusColor(730)).toBe('#22c55e')
    expect(contractStatusColor(1000)).toBe('#22c55e')
  })
})

describe('contractStatus', () => {
  it('returns expired for negative days', () => {
    expect(contractStatus(-1)).toBe('expired')
  })

  it('returns critical for < 1 year', () => {
    expect(contractStatus(0)).toBe('critical')
    expect(contractStatus(364)).toBe('critical')
  })

  it('returns warning for 1-2 years', () => {
    expect(contractStatus(365)).toBe('warning')
    expect(contractStatus(729)).toBe('warning')
  })

  it('returns ok for > 2 years', () => {
    expect(contractStatus(730)).toBe('ok')
  })
})

describe('STATUS_COLORS', () => {
  it('has a color for every status', () => {
    expect(STATUS_COLORS.ok).toBeTruthy()
    expect(STATUS_COLORS.warning).toBeTruthy()
    expect(STATUS_COLORS.critical).toBeTruthy()
    expect(STATUS_COLORS.expired).toBeTruthy()
  })
})
