import { describe, expect, it } from 'vitest'
import { NoAssetsError, parseCsvToGantt } from '../pipeline'

const HEADER =
  'ASSET ID,PRODUCT NAME,PRODUCT TYPE,INSTALL BASE AGE,LOCATION ID,LOCATION NAME,SERVICES STATUS,CONTRACT END DATE,END OF STANDARD SUPPORT,CITY,COUNTRY'

const HARDWARE_ROW =
  'A001,PowerEdge R740,HARDWARE,"2yr, 3mo",LOC1,Main DC,Active,"December 31, 2027",,Geneva,Switzerland'

describe('parseCsvToGantt', () => {
  it('produces gantt tasks from a valid CSV', () => {
    const result = parseCsvToGantt(`${HEADER}\n${HARDWARE_ROW}`)
    expect(result.totalAssets).toBe(1)
    expect(result.locationGroups).toHaveLength(1)
    expect(result.ganttData.tasks.length).toBeGreaterThan(0)
  })

  it('throws when no headers are recognised', () => {
    expect(() => parseCsvToGantt('foo,bar\n1,2')).toThrow(/recognised/i)
  })

  it('throws NoAssetsError when nothing matches the filter', () => {
    const software =
      'A001,vSphere,SOFTWARE,1yr,LOC1,Main DC,Active,"January 01, 2030",,Geneva,Switzerland'
    expect(() => parseCsvToGantt(`${HEADER}\n${software}`)).toThrow(NoAssetsError)
  })
})
