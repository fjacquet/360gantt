import { forwardRef } from 'react'
import type { CSSProperties } from 'react'
import { Gantt, Willow, WillowDark } from '@svar-ui/react-gantt'
import { ZOOM_PRESETS, useAssetStore } from '@store/assetStore'
import { useDarkMode } from '@hooks/useDarkMode'
import type { GanttTask } from '@/types/gantt'

interface GanttPanelProps {
  className?: string
  style?: CSSProperties
}

export const GanttPanel = forwardRef<HTMLDivElement, GanttPanelProps>(function GanttPanel(
  { className, style },
  ref,
) {
  const { ganttData, filters, zoomLevel } = useAssetStore()
  const dark = useDarkMode()
  const scales = ZOOM_PRESETS[zoomLevel]?.scales ?? ZOOM_PRESETS[2]!.scales

  const tasks =
    filters.locationIds.length > 0 || filters.search
      ? applyFilters(ganttData.tasks, filters.locationIds, filters.search)
      : ganttData.tasks

  const Theme = dark ? WillowDark : Willow

  return (
    <div
      ref={ref}
      className={className}
      style={{
        height: '100%',
        minHeight: 0,
        // Override SVAR CSS variables for a compact, readable density
        '--wx-font-size': '12px',
        '--wx-font-size-sm': '11px',
        ...style,
      } as CSSProperties}
    >
      <Theme>
        <Gantt
          tasks={tasks}
          links={ganttData.links}
          readonly
          scales={scales}
          cellWidth={70}
          cellHeight={28}
          columns={[{ id: 'text', header: 'Asset / Product', width: 260 }]}
        />
      </Theme>
    </div>
  )
})

/**
 * Filter tasks preserving the 3-level hierarchy:
 * keeps location → product summary tasks when any child asset matches the search.
 */
function applyFilters(
  allTasks: GanttTask[],
  _locationIds: string[],
  search: string,
): GanttTask[] {
  if (!search) return allTasks

  const searchLower = search.toLowerCase()

  // Build parent → children index
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
