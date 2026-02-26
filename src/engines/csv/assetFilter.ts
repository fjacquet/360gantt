import { ACTIVE_VALUES, HARDWARE_VALUES, type FieldMap } from './headerResolver'
import { parseContractDate, parseInstallBaseAge } from './dateParser'
import type { ParsedAsset, RawAsset } from '@/types/asset'

/**
 * Convert a raw CSV row (keyed by actual headers) into a RawAsset
 * using the resolved FieldMap.
 */
export function toRawAsset(row: Record<string, string>, fieldMap: FieldMap): RawAsset {
  const get = (field: keyof FieldMap) => {
    const key = fieldMap[field]
    return (key ? (row[key] ?? '') : '').trim()
  }
  return {
    assetId: get('assetId'),
    productName: get('productName'),
    productType: get('productType'),
    installBaseAge: get('installBaseAge'),
    locationId: get('locationId'),
    locationName: get('locationName'),
    servicesStatus: get('servicesStatus'),
    contractEndDate: get('contractEndDate'),
    endOfStandardSupport: get('endOfStandardSupport'),
    city: get('city'),
    country: get('country'),
  }
}

/**
 * Returns true if the raw asset should be included in the Gantt chart:
 *  - product type is HARDWARE (any language)
 *  - services status is Active (any language)
 *  - has a parseable contract end date (or end of standard support)
 */
export function isIncluded(raw: RawAsset): boolean {
  const typeUpper = raw.productType.toUpperCase()
  if (!HARDWARE_VALUES.some((v) => v.toUpperCase() === typeUpper)) return false

  const statusLower = raw.servicesStatus.toLowerCase()
  if (!ACTIVE_VALUES.some((v) => v.toLowerCase() === statusLower)) return false

  const contractEnd =
    parseContractDate(raw.contractEndDate) ?? parseContractDate(raw.endOfStandardSupport)
  return contractEnd !== null
}

/**
 * Converts a raw asset into a ParsedAsset.
 * Assumes isIncluded() has already returned true.
 */
export function toParsedAsset(raw: RawAsset, today = new Date()): ParsedAsset {
  const contractEnd =
    // biome-ignore lint/style/noNonNullAssertion: guaranteed by isIncluded()
    parseContractDate(raw.contractEndDate) ?? parseContractDate(raw.endOfStandardSupport)!

  const installDate = parseInstallBaseAge(raw.installBaseAge, today) ?? contractEnd

  const daysRemaining = Math.floor(
    (contractEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  )

  return {
    assetId: raw.assetId,
    productName: raw.productName,
    locationId: raw.locationId,
    locationName: raw.locationName,
    city: raw.city,
    country: raw.country,
    installDate,
    contractEnd,
    daysRemaining,
  }
}

/**
 * Filter and parse an array of raw assets.
 */
export function filterAssets(raws: RawAsset[], today = new Date()): ParsedAsset[] {
  return raws.filter(isIncluded).map((r) => toParsedAsset(r, today))
}
