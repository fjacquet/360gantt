import type { ContractStatus } from '@/types/asset'

/** Midnight Executive palette; hex without '#' as pptxgenjs expects. */
export const THEME = {
  navy: '1E2761',
  ice: 'CADCFC',
  gold: 'F9B935',
  darkText: '21295C',
  grey: '6B7291',
  lightBg: 'F5F7FC',
  green: '2E8B57',
  orange: 'E07B00',
  red: 'C0392B',
  white: 'FFFFFF',
} as const

export const SLIDE_W = 13.333
export const SLIDE_H = 7.5
export const FONT = 'Calibri'

const STATUS_HEX: Record<ContractStatus, string> = {
  ok: THEME.green,
  warning: THEME.orange,
  critical: THEME.red,
  expired: THEME.grey,
}

export function statusColor(status: ContractStatus): string {
  return STATUS_HEX[status]
}
