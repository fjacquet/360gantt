/**
 * Normalises multilingual Dell asset CSV headers to canonical English keys.
 * Supports EN, FR, IT, DE exports.
 */

/** Canonical field names we care about */
export type CanonicalField =
  | 'assetId'
  | 'productName'
  | 'productType'
  | 'installBaseAge'
  | 'locationId'
  | 'locationName'
  | 'servicesStatus'
  | 'contractEndDate'
  | 'endOfStandardSupport'
  | 'city'
  | 'country'

/** Maps canonical key → actual column header found in the CSV */
export type FieldMap = Record<CanonicalField, string>

/** Multi-language aliases for each canonical field */
const HEADER_ALIASES: Record<CanonicalField, string[]> = {
  assetId: ['ASSET ID', "ID D'ACTIF", "ID D\u2019ACTIF", 'ID ASSET', 'ASSET-ID'],
  productName: ['PRODUCT NAME', 'NOM DU PRODUIT', 'NOME DEL PRODOTTO', 'PRODUKTNAME'],
  productType: ['PRODUCT TYPE', 'TYPE DE PRODUIT', 'TIPO DI PRODOTTO', 'PRODUKTTYP'],
  installBaseAge: [
    'INSTALL BASE AGE',
    "ÂGE DE LA BASE D'INSTALLATION",
    "ÂGE DE LA BASE D\u2019INSTALLATION",
    'ETÀ BASE INSTALLATA',
    'ALTER DER INSTALLATIONSBASIS',
  ],
  locationId: [
    'LOCATION ID',
    "ID D'EMPLACEMENT",
    "ID D\u2019EMPLACEMENT",
    'ID POSIZIONE',
    'STANDORT-ID',
  ],
  locationName: [
    'LOCATION NAME',
    "NOM DE L'EMPLACEMENT",
    "NOM DE L\u2019EMPLACEMENT",
    'NOME POSIZIONE',
    'STANDORTNAME',
  ],
  servicesStatus: [
    'SERVICES STATUS',
    'STATUT DES SERVICES',
    'STATO DEI SERVIZI',
    'SERVICESTATUS',
  ],
  contractEndDate: [
    'CONTRACT END DATE',
    'DATE DE FIN DU CONTRAT',
    'DATA DI FINE CONTRATTO',
    'VERTRAGSENDE',
  ],
  endOfStandardSupport: [
    'END OF STANDARD SUPPORT',
    'FIN DU SUPPORT STANDARD',
    'FINE DEL SUPPORTO STANDARD',
    'ENDE DES STANDARDSUPPORTS',
  ],
  city: ['CITY', 'VILLE', 'CITTÀ', 'STADT'],
  country: ['COUNTRY', 'PAYS', 'PAESE', 'LAND'],
}

/** Canonical values for filtering (multi-language) */
export const HARDWARE_VALUES = ['HARDWARE', 'MATÉRIEL', 'MATERIALE']
export const ACTIVE_VALUES = ['Active', 'Actif', 'Attivo', 'Aktiv']

/**
 * Given the raw header row from a CSV, returns a FieldMap that
 * resolves each canonical field to the actual column header found.
 *
 * Throws if no recognised headers are found at all.
 */
export function resolveHeaders(rawHeaders: string[]): FieldMap {
  const normalised = rawHeaders.map((h) => h.trim().toUpperCase())

  const fieldMap: Partial<FieldMap> = {}

  for (const [canonical, aliases] of Object.entries(HEADER_ALIASES) as [
    CanonicalField,
    string[],
  ][]) {
    const aliasesUpper = aliases.map((a) => a.toUpperCase())
    const found = rawHeaders.find((_, i) => {
      const h = normalised[i]
      return h !== undefined && aliasesUpper.some((a) => h === a)
    })
    if (found !== undefined) {
      fieldMap[canonical] = found
    }
  }

  const resolved = Object.keys(fieldMap).length
  if (resolved === 0) {
    throw new Error('No recognised Dell asset CSV headers found. Please check the file format.')
  }

  // Fill missing optional fields with empty string sentinel
  const defaults: FieldMap = {
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

  return { ...defaults, ...fieldMap }
}
