import { describe, expect, it } from 'vitest'
import { resolveHeaders, HARDWARE_VALUES, ACTIVE_VALUES } from '../headerResolver'

describe('resolveHeaders', () => {
  it('resolves English headers', () => {
    const headers = [
      'ASSET ID',
      'PRODUCT NAME',
      'PRODUCT TYPE',
      'INSTALL BASE AGE',
      'LOCATION ID',
      'LOCATION NAME',
      'SERVICES STATUS',
      'CONTRACT END DATE',
      'END OF STANDARD SUPPORT',
      'CITY',
      'COUNTRY',
    ]
    const map = resolveHeaders(headers)
    expect(map.assetId).toBe('ASSET ID')
    expect(map.productName).toBe('PRODUCT NAME')
    expect(map.contractEndDate).toBe('CONTRACT END DATE')
    expect(map.city).toBe('CITY')
  })

  it('resolves French headers', () => {
    const headers = [
      "ID D'ACTIF",
      'NOM DU PRODUIT',
      'TYPE DE PRODUIT',
      "ÂGE DE LA BASE D'INSTALLATION",
      "ID D'EMPLACEMENT",
      "NOM DE L'EMPLACEMENT",
      'STATUT DES SERVICES',
      'DATE DE FIN DU CONTRAT',
      'FIN DU SUPPORT STANDARD',
      'VILLE',
      'PAYS',
    ]
    const map = resolveHeaders(headers)
    expect(map.assetId).toBe("ID D'ACTIF")
    expect(map.productName).toBe('NOM DU PRODUIT')
    expect(map.contractEndDate).toBe('DATE DE FIN DU CONTRAT')
    expect(map.city).toBe('VILLE')
  })

  it('resolves French headers with typographic apostrophe', () => {
    const headers = ['ID D\u2019ACTIF', 'NOM DU PRODUIT']
    const map = resolveHeaders(headers)
    expect(map.assetId).toBe('ID D\u2019ACTIF')
  })

  it('resolves Italian headers', () => {
    const headers = ['ID ASSET', 'NOME DEL PRODOTTO', 'TIPO DI PRODOTTO', 'DATA DI FINE CONTRATTO']
    const map = resolveHeaders(headers)
    expect(map.assetId).toBe('ID ASSET')
    expect(map.contractEndDate).toBe('DATA DI FINE CONTRATTO')
  })

  it('resolves German headers', () => {
    const headers = ['ASSET-ID', 'PRODUKTNAME', 'PRODUKTTYP', 'VERTRAGSENDE']
    const map = resolveHeaders(headers)
    expect(map.assetId).toBe('ASSET-ID')
    expect(map.contractEndDate).toBe('VERTRAGSENDE')
  })

  it('throws when no recognised headers are found', () => {
    expect(() => resolveHeaders(['UNKNOWN_COL', 'ANOTHER_COL'])).toThrow()
  })

  it('fills missing fields with empty string', () => {
    const map = resolveHeaders(['ASSET ID'])
    expect(map.city).toBe('')
    expect(map.country).toBe('')
  })
})

describe('value constants', () => {
  it('HARDWARE_VALUES includes multilingual variants', () => {
    expect(HARDWARE_VALUES).toContain('HARDWARE')
    expect(HARDWARE_VALUES).toContain('MATÉRIEL')
  })

  it('ACTIVE_VALUES includes multilingual variants', () => {
    expect(ACTIVE_VALUES).toContain('Active')
    expect(ACTIVE_VALUES).toContain('Actif')
    expect(ACTIVE_VALUES).toContain('Attivo')
    expect(ACTIVE_VALUES).toContain('Aktiv')
  })
})
