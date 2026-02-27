import { describe, expect, it } from 'vitest'
import { contractStatusColor, contractStatus, STATUS_COLORS } from '../colors'

describe('contractStatusColor', () => {
  it('returns gray for expired contracts', () => {
    expect(contractStatusColor(-1)).toBe('#9ca3af')
    expect(contractStatusColor(-100)).toBe('#9ca3af')
  })

  it('returns Dell dark blue for < 1 year remaining', () => {
    expect(contractStatusColor(0)).toBe('#003B6F')
    expect(contractStatusColor(364)).toBe('#003B6F')
  })

  it('returns Dell blue for 1-2 years remaining', () => {
    expect(contractStatusColor(365)).toBe('#0076CE')
    expect(contractStatusColor(729)).toBe('#0076CE')
  })

  it('returns Dell light blue for > 2 years remaining', () => {
    expect(contractStatusColor(730)).toBe('#7EC8E3')
    expect(contractStatusColor(1000)).toBe('#7EC8E3')
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
