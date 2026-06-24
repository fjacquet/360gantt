import { useTranslation } from 'react-i18next'
import { useAssetStore } from '@store/assetStore'
import { STATUS_COLORS, STATUS_ORDER } from '@utils/colors'
import type { ContractStatus } from '@/types/asset'

export function FilterPanel() {
  const { t } = useTranslation()
  const { locationGroups, filters, setFilters, ganttData } = useAssetStore()
  const hasData = ganttData.tasks.length > 0

  if (!hasData) return null

  const toggleLocation = (id: string) => {
    const current = filters.locationIds
    const next = current.includes(id) ? current.filter((l) => l !== id) : [...current, id]
    setFilters({ locationIds: next })
  }

  const statusItems = STATUS_ORDER.map((status) => ({ status, label: t(`status.${status}`) }))

  const toggleStatus = (s: ContractStatus) => {
    const cur = filters.statuses
    setFilters({ statuses: cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s] })
  }

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="filter-search" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {t('filter.search')}
        </label>
        <input
          id="filter-search"
          type="search"
          value={filters.search}
          onChange={(e) => setFilters({ search: e.target.value })}
          placeholder={t('filter.search')}
          className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        />
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {t('filter.locations')}
          </p>
          {filters.locationIds.length > 0 && (
            <button
              type="button"
              onClick={() => setFilters({ locationIds: [] })}
              className="text-xs text-blue-600 hover:underline dark:text-blue-400"
            >
              {t('filter.clear')}
            </button>
          )}
        </div>
        <div className="max-h-48 space-y-1 overflow-y-auto">
          {locationGroups.map((loc) => (
            <label key={loc.locationId} className="flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={
                  filters.locationIds.length === 0 || filters.locationIds.includes(loc.locationId)
                }
                onChange={() => toggleLocation(loc.locationId)}
                className="mt-0.5"
              />
              <span className="truncate dark:text-gray-200">
                {loc.locationName || loc.locationId}
                {loc.city && (
                  <span className="ml-1 text-xs text-gray-400">({loc.city})</span>
                )}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Legend — click a row to show/hide that status bucket */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {t('filter.legend')}
          </p>
          {filters.statuses.length < STATUS_ORDER.length && (
            <button
              type="button"
              onClick={() => setFilters({ statuses: [...STATUS_ORDER] })}
              className="text-xs text-blue-600 hover:underline dark:text-blue-400"
            >
              {t('filter.showAll')}
            </button>
          )}
        </div>
        <div className="space-y-1">
          {statusItems.map(({ status, label }) => {
            const visible = filters.statuses.includes(status)
            return (
              <button
                key={status}
                type="button"
                aria-pressed={visible}
                onClick={() => toggleStatus(status)}
                className={`flex w-full items-center gap-2 text-xs ${
                  visible
                    ? 'text-gray-600 dark:text-gray-300'
                    : 'text-gray-400 line-through opacity-50 dark:text-gray-500'
                }`}
              >
                <span
                  className="inline-block h-3 w-3 flex-shrink-0 rounded-sm"
                  style={{ backgroundColor: STATUS_COLORS[status] }}
                />
                {label}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
