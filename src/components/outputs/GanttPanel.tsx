import { forwardRef } from 'react'
import type { CSSProperties } from 'react'
import { SCALE_STEPS, ZOOM_PRESETS, useAssetStore } from '@store/assetStore'
import { useDarkMode } from '@hooks/useDarkMode'
import { toGanttData } from '@engines/csv/svarAdapter'
import type { GanttTask } from '@/types/gantt'
import { SvgGantt } from './gantt'

interface GanttPanelProps {
  className?: string
  style?: CSSProperties
}

export const GanttPanel = forwardRef<HTMLDivElement, GanttPanelProps>(function GanttPanel(
  { className, style },
  ref,
) {
  const { ganttData, locationGroups, filters, zoomLevel, scaleIdx } = useAssetStore()
  const dark = useDarkMode()
  const scales = ZOOM_PRESETS[zoomLevel]?.scales ?? ZOOM_PRESETS[1]?.scales ?? []
  const cssZoom = SCALE_STEPS[scaleIdx] ?? 1

  // Step 1: filter by location using string IDs from locationGroups
  const visibleGroups =
    filters.locationIds.length > 0
      ? locationGroups.filter((g) => filters.locationIds.includes(g.locationId))
      : locationGroups

  // Step 2: derive base tasks (recompute only when location filter is active)
  const baseTasks =
    filters.locationIds.length > 0 ? toGanttData(visibleGroups).tasks : ganttData.tasks

  // Step 3: apply text search on the already-location-filtered flat task list
  const tasks = filters.search ? applySearchFilter(baseTasks, filters.search) : baseTasks

  return (
    <div
      ref={ref}
      className={className}
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'auto',
        zoom: cssZoom,
        ...style,
      } as CSSProperties}
    >
      <SvgGantt tasks={tasks} scales={scales} dark={dark} />
    </div>
  )
})

/**
 * Filter tasks by free-text search, preserving the 3-level hierarchy:
 * keeps location -> product summary tasks when any child asset matches.
 */
function applySearchFilter(allTasks: GanttTask[], search: string): GanttTask[] {
  if (!search) return allTasks

  const searchLower = search.toLowerCase()

  // Build parent -> children index
  const childrenOf = new Map<number | string, GanttTask[]>()
  for (const task of allTasks) {
    if (task.parent !== undefined && task.parent !== 0) {
      const siblings = childrenOf.get(task.parent) ?? []
      siblings.push(task)
      childrenOf.set(task.parent, siblings)
    }
  }

  const result: GanttTask[] = []

  for (const locTask of allTasks.filter(
    (t) => t.type === 'summary' && (t.parent === 0 || t.parent === undefined),
  )) {
    const productTasks = childrenOf.get(locTask.id) ?? []
    const keptProducts: GanttTask[] = []

    for (const prodTask of productTasks) {
      const assetTasks = childrenOf.get(prodTask.id) ?? []
      const matching = assetTasks.filter((a) => a.text.toLowerCase().includes(searchLower))
      if (matching.length > 0) {
        keptProducts.push(prodTask, ...matching)
      }
    }

    if (keptProducts.length > 0) {
      result.push(locTask, ...keptProducts)
    }
  }

  return result.length > 0 ? result : allTasks
}
