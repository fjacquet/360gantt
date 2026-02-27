import type { ContractStatus } from '@/types/asset'

/** Return a Dell-blue palette color based on days remaining on a contract. */
export function contractStatusColor(daysRemaining: number): string {
  if (daysRemaining < 0) return '#9ca3af' // gray-400 — expired
  if (daysRemaining < 365) return '#003B6F' // Dell dark blue — < 1 year
  if (daysRemaining < 730) return '#0076CE' // Dell blue — 1-2 years
  return '#7EC8E3' // Dell light blue — > 2 years
}

export function contractStatus(daysRemaining: number): ContractStatus {
  if (daysRemaining < 0) return 'expired'
  if (daysRemaining < 365) return 'critical'
  if (daysRemaining < 730) return 'warning'
  return 'ok'
}

export const STATUS_COLORS: Record<ContractStatus, string> = {
  ok: '#7EC8E3',
  warning: '#0076CE',
  critical: '#003B6F',
  expired: '#9ca3af',
}
