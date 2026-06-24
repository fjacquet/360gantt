import de from '../locales/de.json'
import en from '../locales/en.json'
import fr from '../locales/fr.json'
import itLocale from '../locales/it.json'

const locales: Record<string, { filter: Record<string, string> }> = { en, fr, it: itLocale, de }

describe('locale completeness for the legend filter', () => {
  for (const [name, dict] of Object.entries(locales)) {
    it(`${name} defines filter.legend and filter.showAll`, () => {
      expect(dict.filter.legend).toBeTruthy()
      expect(dict.filter.showAll).toBeTruthy()
    })
  }
})
