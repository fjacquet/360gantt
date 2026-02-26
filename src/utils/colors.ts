import type { ContractStatus } from '@/types/asset'

/** Return a Tailwind-compatible hex color based on days remaining on a contract. */
export function contractStatusColor(daysRemaining: number): string {
  if (daysRemaining < 0) return '#9ca3af' // gray-400 — expired
  if (daysRemaining < 365) return '#ef4444' // red-500 — < 1 year
  if (daysRemaining < 730) return '#f59e0b' // amber-500 — 1-2 years
  return '#22c55e' // green-500 — > 2 years
}

export function contractStatus(daysRemaining: number): ContractStatus {
  if (daysRemaining < 0) return 'expired'
  if (daysRemaining < 365) return 'critical'
  if (daysRemaining < 730) return 'warning'
  return 'ok'
}

export const STATUS_COLORS: Record<ContractStatus, string> = {
  ok: '#22c55e',
  warning: '#f59e0b',
  critical: '#ef4444',
  expired: '#9ca3af',
}
