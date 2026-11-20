/** All user-visible deck text, in one place so it can be translated later. */
export const PPTX_STRINGS = {
  deckTitle: '360 Gantt — Contract Coverage',
  eyebrow: 'ASSET LIFECYCLE — CONTRACT COVERAGE',
  kpi: {
    locations: 'Locations',
    assets: 'Assets',
    underOneYear: 'Expiring < 1 year',
    expired: 'Expired',
  },
  overviewTitle: 'Overview',
  overviewContinued: 'Overview (continued)',
  overviewHeaders: ['Location', '> 2 years', '1–2 years', '< 1 year', 'Expired', 'Total'],
  legend: ['> 2 years', '1–2 years', '< 1 year', 'Expired'],
  today: 'Today',
} as const
