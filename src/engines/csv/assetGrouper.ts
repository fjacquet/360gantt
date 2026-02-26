import type { LocationGroup, ParsedAsset, ProductGroup } from '@/types/asset'

/**
 * Groups parsed assets by locationId → productName.
 * Locations and product groups are sorted by their end date (soonest first)
 * so the most urgent items appear at the top.
 */
export function groupAssets(assets: ParsedAsset[]): LocationGroup[] {
  // Accumulate into a map: locationId → productName → assets[]
  const locationMap = new Map<string, Map<string, ParsedAsset[]>>()

  for (const asset of assets) {
    let productMap = locationMap.get(asset.locationId)
    if (!productMap) {
      productMap = new Map()
      locationMap.set(asset.locationId, productMap)
    }
    const existing = productMap.get(asset.productName) ?? []
    existing.push(asset)
    productMap.set(asset.productName, existing)
  }

  const locationGroups: LocationGroup[] = []

  for (const [locationId, productMap] of locationMap) {
    const productGroups: ProductGroup[] = []

    for (const [productName, productAssets] of productMap) {
      // Sort assets within a product group by contract end (soonest first)
      productAssets.sort((a, b) => a.contractEnd.getTime() - b.contractEnd.getTime())

      const groupStart = productAssets.reduce(
        (min, a) => (a.installDate < min ? a.installDate : min),
        productAssets[0]?.installDate ?? new Date(),
      )
      const groupEnd = productAssets.reduce(
        (max, a) => (a.contractEnd > max ? a.contractEnd : max),
        productAssets[0]?.contractEnd ?? new Date(),
      )

      productGroups.push({ productName, assets: productAssets, groupStart, groupEnd })
    }

    // Sort product groups by their end date
    productGroups.sort((a, b) => a.groupEnd.getTime() - b.groupEnd.getTime())

    const representative = assets.find((a) => a.locationId === locationId)
    const locationStart = productGroups.reduce(
      (min, g) => (g.groupStart < min ? g.groupStart : min),
      productGroups[0]?.groupStart ?? new Date(),
    )
    const locationEnd = productGroups.reduce(
      (max, g) => (g.groupEnd > max ? g.groupEnd : max),
      productGroups[0]?.groupEnd ?? new Date(),
    )

    locationGroups.push({
      locationId,
      locationName: representative?.locationName ?? locationId,
      city: representative?.city ?? '',
      country: representative?.country ?? '',
      productGroups,
      locationStart,
      locationEnd,
    })
  }

  // Sort locations by end date
  locationGroups.sort((a, b) => a.locationEnd.getTime() - b.locationEnd.getTime())

  return locationGroups
}
