import type { LocationGroup } from '@/types/asset'
import type { GanttData, GanttTask } from '@/types/gantt'
import { contractStatusColor } from '@/utils/colors'

/**
 * Converts the grouped location data into the flat task array
 * expected by @svar-ui/react-gantt, with a three-level hierarchy:
 *
 *   Location (summary, parent=0)
 *     └── ProductGroup (summary, parent=locationTask.id)
 *           └── Asset (task, parent=productTask.id)
 */
export function toGanttData(locationGroups: LocationGroup[], today = new Date()): GanttData {
  const tasks: GanttTask[] = []
  let idCounter = 1

  for (const location of locationGroups) {
    const locationId = idCounter++
    const locationLabel = [location.locationName, location.city, location.country]
      .filter(Boolean)
      .join(', ')

    tasks.push({
      id: locationId,
      text: locationLabel,
      start: location.locationStart,
      end: location.locationEnd,
      type: 'summary',
      open: true,
    })

    for (const group of location.productGroups) {
      const productId = idCounter++
      const assetCount = group.assets.length
      const label = assetCount > 1 ? `${group.productName} (${assetCount})` : group.productName

      tasks.push({
        id: productId,
        text: label,
        start: group.groupStart,
        end: group.groupEnd,
        type: 'summary',
        parent: locationId,
        open: false,
      })

      for (const asset of group.assets) {
        const color = contractStatusColor(asset.daysRemaining)
        tasks.push({
          id: idCounter++,
          text: `${asset.productName} (${asset.assetId})`,
          start: asset.installDate,
          end: asset.contractEnd,
          type: 'task',
          parent: productId,
          color,
        })
      }
    }
  }

  return { tasks, links: [] }
}
