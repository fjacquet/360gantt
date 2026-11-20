import { statusColor } from '../theme'

describe('statusColor', () => {
  it('maps each status to its palette hex', () => {
    expect(statusColor('ok')).toBe('2E8B57')
    expect(statusColor('warning')).toBe('E07B00')
    expect(statusColor('critical')).toBe('C0392B')
    expect(statusColor('expired')).toBe('6B7291')
  })
})
