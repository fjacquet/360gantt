// Raw row from PapaParse (normalized header keys)
export interface RawAsset {
  assetId: string
  productName: string
  productType: string
  installBaseAge: string
  locationId: string
  locationName: string
  servicesStatus: string
  contractEndDate: string
  endOfStandardSupport: string
  city: string
  country: string
}

// After filtering and date parsing
export interface ParsedAsset {
  assetId: string
  productName: string
  locationId: string
  locationName: string
  city: string
  country: string
  installDate: Date
  contractEnd: Date
  /** Days until contract end (negative = already expired) */
  daysRemaining: number
}

// Assets sharing the same product name within a location
export interface ProductGroup {
  productName: string
  assets: ParsedAsset[]
  /** Earliest install date across all assets in this group */
  groupStart: Date
  /** Latest contract end date across all assets in this group */
  groupEnd: Date
}

// Top-level grouping by location
export interface LocationGroup {
  locationId: string
  locationName: string
  city: string
  country: string
  productGroups: ProductGroup[]
  /** Earliest install date across all products in this location */
  locationStart: Date
  /** Latest contract end date across all products in this location */
  locationEnd: Date
}

export type ContractStatus = 'ok' | 'warning' | 'critical' | 'expired'
