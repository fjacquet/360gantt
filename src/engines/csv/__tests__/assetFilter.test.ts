import { describe, expect, it } from 'vitest'
import { isIncluded, toParsedAsset, toRawAsset, filterAssets } from '../assetFilter'
import type { RawAsset } from '@/types/asset'
import type { FieldMap } from '../headerResolver'

const baseAsset: RawAsset = {
  assetId: 'ABC123',
  productName: 'PowerEdge R740',
  productType: 'HARDWARE',
  installBaseAge: '2yr',
  locationId: 'LOC001',
  locationName: 'Main DC',
  servicesStatus: 'Active',
  contractEndDate: 'December 31, 2027',
  endOfStandardSupport: '',
  city: 'Geneva',
  country: 'Switzerland',
}

describe('isIncluded', () => {
  it('includes hardware + active with contract date', () => {
    expect(isIncluded(baseAsset)).toBe(true)
  })

  it('excludes software assets', () => {
    expect(isIncluded({ ...baseAsset, productType: 'SOFTWARE' })).toBe(false)
  })

  it('excludes non-active status', () => {
    expect(isIncluded({ ...baseAsset, servicesStatus: 'Ended' })).toBe(false)
  })

  it('excludes missing contract end date', () => {
    expect(isIncluded({ ...baseAsset, contractEndDate: '', endOfStandardSupport: '' })).toBe(false)
  })

  it('includes French hardware type (MATÉRIEL)', () => {
    expect(isIncluded({ ...baseAsset, productType: 'MATÉRIEL' })).toBe(true)
  })

  it('includes French active status (Actif)', () => {
    expect(isIncluded({ ...baseAsset, servicesStatus: 'Actif' })).toBe(true)
  })

  it('falls back to endOfStandardSupport if contractEndDate missing', () => {
    const asset = { ...baseAsset, contractEndDate: '', endOfStandardSupport: 'June 30, 2030' }
    expect(isIncluded(asset)).toBe(true)
  })
})

describe('toParsedAsset', () => {
  const today = new Date(2025, 0, 1)

  it('correctly parses a valid asset', () => {
    const parsed = toParsedAsset(baseAsset, today)
    expect(parsed.assetId).toBe('ABC123')
    expect(parsed.productName).toBe('PowerEdge R740')
    expect(parsed.contractEnd.getFullYear()).toBe(2027)
    expect(parsed.daysRemaining).toBeGreaterThan(0)
  })

  it('sets negative daysRemaining for expired contracts', () => {
    const expired = { ...baseAsset, contractEndDate: 'January 01, 2020' }
    const parsed = toParsedAsset(expired, today)
    expect(parsed.daysRemaining).toBeLessThan(0)
  })

  it('uses installBaseAge to derive installDate', () => {
    const parsed = toParsedAsset(baseAsset, today)
    expect(parsed.installDate).toBeInstanceOf(Date)
    expect(parsed.installDate < today).toBe(true)
  })

  it('falls back to contractEnd when installBaseAge is missing', () => {
    const asset = { ...baseAsset, installBaseAge: '' }
    const parsed = toParsedAsset(asset, today)
    expect(parsed.installDate.getTime()).toBe(parsed.contractEnd.getTime())
  })
})

describe('toRawAsset', () => {
  const fieldMap: FieldMap = {
    assetId: 'ASSET ID',
    productName: 'PRODUCT NAME',
    productType: 'PRODUCT TYPE',
    installBaseAge: 'INSTALL BASE AGE',
    locationId: 'LOCATION ID',
    locationName: 'LOCATION NAME',
    servicesStatus: 'SERVICES STATUS',
    contractEndDate: 'CONTRACT END DATE',
    endOfStandardSupport: 'END OF STANDARD SUPPORT',
    city: 'CITY',
    country: 'COUNTRY',
  }

  it('maps CSV row to RawAsset using fieldMap', () => {
    const row: Record<string, string> = {
      'ASSET ID': 'X99',
      'PRODUCT NAME': 'Unity XT',
      'PRODUCT TYPE': 'HARDWARE',
      'INSTALL BASE AGE': '1yr',
      'LOCATION ID': 'L9',
      'LOCATION NAME': 'Remote DC',
      'SERVICES STATUS': 'Active',
      'CONTRACT END DATE': 'March 15, 2028',
      'END OF STANDARD SUPPORT': '',
      'CITY': 'Zurich',
      'COUNTRY': 'Switzerland',
    }
    const raw = toRawAsset(row, fieldMap)
    expect(raw.assetId).toBe('X99')
    expect(raw.productName).toBe('Unity XT')
    expect(raw.city).toBe('Zurich')
  })

  it('returns empty string for missing columns', () => {
    const emptyMap: FieldMap = {
      assetId: '',
      productName: '',
      productType: '',
      installBaseAge: '',
      locationId: '',
      locationName: '',
      servicesStatus: '',
      contractEndDate: '',
      endOfStandardSupport: '',
      city: '',
      country: '',
    }
    const raw = toRawAsset({}, emptyMap)
    expect(raw.assetId).toBe('')
    expect(raw.city).toBe('')
  })
})

describe('filterAssets', () => {
  it('returns only parseable hardware/active assets', () => {
    const raws: RawAsset[] = [
      { ...baseAsset, assetId: 'KEEP' },
      { ...baseAsset, assetId: 'SKIP_SW', productType: 'SOFTWARE' },
      { ...baseAsset, assetId: 'SKIP_END', servicesStatus: 'Ended' },
    ]
    const parsed = filterAssets(raws)
    expect(parsed).toHaveLength(1)
    expect(parsed[0]?.assetId).toBe('KEEP')
  })

  it('returns empty array when nothing matches', () => {
    expect(filterAssets([{ ...baseAsset, productType: 'SOFTWARE' }])).toHaveLength(0)
  })
})
