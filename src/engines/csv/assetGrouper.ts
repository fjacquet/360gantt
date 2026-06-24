import type { LocationGroup, ParsedAsset, ProductGroup } from '@/types/asset'

/** Latest of a list of dates (defaults to now for an empty list). */
function latest(dates: Date[]): Date {
  return dates.reduce((max, d) => (d > max ? d : max), dates[0] ?? new Date())
}

/** Earliest of a list of dates (defaults to now for an empty list). */
function earliest(dates: Date[]): Date {
  return dates.reduce((min, d) => (d < min ? d : min), dates[0] ?? new Date())
}

/**
 * Groups parsed assets by locationId → productName.
 * Summary spans (groupEnd / locationEnd) extend to the latest child barEnd,
 * but ordering stays driven by contract end (soonest first) so the most
 * urgent items — including overdue/expired contracts — appear at the top.
 */
export function groupAssets(assets: ParsedAsset[]): LocationGroup[] {
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

      const groupStart = earliest(productAssets.map((a) => a.installDate))
      // Span extends to the latest bar end (end-of-support for expired assets)
      const groupEnd = latest(productAssets.map((a) => a.barEnd))

      productGroups.push({ productName, assets: productAssets, groupStart, groupEnd })
    }

    // Order product groups by urgency: latest contract end (NOT barEnd), soonest first
    productGroups.sort(
      (a, b) =>
        latest(a.assets.map((x) => x.contractEnd)).getTime() -
        latest(b.assets.map((x) => x.contractEnd)).getTime(),
    )

    const representative = assets.find((a) => a.locationId === locationId)
    const locationStart = earliest(productGroups.map((g) => g.groupStart))
    const locationEnd = latest(productGroups.map((g) => g.groupEnd))

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

  // Order locations by urgency: latest contract end (NOT barEnd), soonest first
  locationGroups.sort(
    (a, b) =>
      latest(a.productGroups.flatMap((g) => g.assets.map((x) => x.contractEnd))).getTime() -
      latest(b.productGroups.flatMap((g) => g.assets.map((x) => x.contractEnd))).getTime(),
  )

  return locationGroups
}
