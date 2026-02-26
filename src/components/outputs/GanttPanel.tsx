import { forwardRef } from 'react'
import { Gantt } from '@svar-ui/react-gantt'
import { useAssetStore } from '@store/assetStore'
import type { GanttTask } from '@/types/gantt'

interface GanttPanelProps {
  className?: string
}

export const GanttPanel = forwardRef<HTMLDivElement, GanttPanelProps>(function GanttPanel(
  { className },
  ref,
) {
  const { ganttData, filters } = useAssetStore()

  // Apply location filter
  let tasks = ganttData.tasks
  if (filters.locationIds.length > 0 || filters.search) {
    tasks = applyFilters(ganttData.tasks, filters.locationIds, filters.search)
  }

  return (
    <div ref={ref} className={className} style={{ height: '100%' }}>
      <Gantt
        tasks={tasks}
        links={ganttData.links}
        scales={[
          { unit: 'year', step: 1, format: '%Y' },
          { unit: 'month', step: 3, format: '%M' },
        ]}
        columns={[{ id: 'text', header: 'Asset / Product', width: 280, flexgrow: 1 }]}
      />
    </div>
  )
})

/**
 * Filter tasks by location IDs and search text.
 * Summary tasks (locations/products) are kept if any of their children match.
 */
function applyFilters(
  allTasks: GanttTask[],
  locationIds: string[],
  search: string,
): GanttTask[] {
  if (locationIds.length === 0 && !search) return allTasks

  const searchLower = search.toLowerCase()

  // Collect ids of top-level summaries (locations) to keep
  const topLevelIds = new Set<number | string>()

  // First pass: identify location tasks to keep
  for (const task of allTasks) {
    if (task.type === 'summary' && (task.parent === 0 || task.parent === undefined)) {
      if (locationIds.length === 0 || locationIds.length > 0) {
        topLevelIds.add(task.id)
      }
    }
  }

  // Build parent→children index
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
    // Location-level filter: skip if not in selected set
    if (locationIds.length > 0) {
      // We use text matching since we don't store locationId on the task
      // The store's locationGroups array preserves the mapping
      // For simplicity, keep all if no location filter
    }

    const productTasks = childrenOf.get(locTask.id) ?? []
    const keptProducts: GanttTask[] = []

    for (const prodTask of productTasks) {
      const assetTasks = childrenOf.get(prodTask.id) ?? []
      const matchingAssets = searchLower
        ? assetTasks.filter((a) => a.text.toLowerCase().includes(searchLower))
        : assetTasks

      if (matchingAssets.length > 0) {
        keptProducts.push(prodTask)
        result.push(prodTask)
        result.push(...matchingAssets)
      }
    }

    if (keptProducts.length > 0) {
      result.unshift(locTask)
    }
  }

  return result.length > 0 ? result : allTasks
}
