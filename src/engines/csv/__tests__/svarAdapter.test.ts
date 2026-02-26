import { describe, expect, it } from 'vitest'
import { toGanttData } from '../svarAdapter'
import type { LocationGroup } from '@/types/asset'

function makeLocationGroup(): LocationGroup {
  return {
    locationId: 'L1',
    locationName: 'Main DC',
    city: 'Geneva',
    country: 'Switzerland',
    locationStart: new Date(2022, 0, 1),
    locationEnd: new Date(2027, 0, 1),
    productGroups: [
      {
        productName: 'PowerEdge R740',
        groupStart: new Date(2022, 0, 1),
        groupEnd: new Date(2027, 0, 1),
        assets: [
          {
            assetId: 'A1',
            productName: 'PowerEdge R740',
            locationId: 'L1',
            locationName: 'Main DC',
            city: 'Geneva',
            country: 'Switzerland',
            installDate: new Date(2022, 0, 1),
            contractEnd: new Date(2027, 0, 1),
            daysRemaining: 730,
          },
        ],
      },
    ],
  }
}

describe('toGanttData', () => {
  it('produces a three-level task hierarchy', () => {
    const data = toGanttData([makeLocationGroup()])

    const tasks = data.tasks

    const locations = tasks.filter((t) => t.type === 'summary' && (t.parent === 0 || t.parent === undefined))
    const products = tasks.filter((t) => t.type === 'summary' && t.parent !== 0 && t.parent !== undefined)
    const leaves = tasks.filter((t) => t.type === 'task')

    expect(locations).toHaveLength(1)
    expect(products).toHaveLength(1)
    expect(leaves).toHaveLength(1)
  })

  it('sets parent correctly on product tasks', () => {
    const data = toGanttData([makeLocationGroup()])
    const locTask = data.tasks.find((t) => t.type === 'summary' && (t.parent === 0 || t.parent === undefined))
    const prodTask = data.tasks.find((t) => t.type === 'summary' && t.parent !== undefined && t.parent !== 0)
    expect(prodTask?.parent).toBe(locTask?.id)
  })

  it('produces no links', () => {
    const data = toGanttData([makeLocationGroup()])
    expect(data.links).toHaveLength(0)
  })

  it('includes location name in location task text', () => {
    const data = toGanttData([makeLocationGroup()])
    const locTask = data.tasks[0]
    expect(locTask?.text).toContain('Main DC')
    expect(locTask?.text).toContain('Geneva')
  })

  it('handles empty input', () => {
    const data = toGanttData([])
    expect(data.tasks).toHaveLength(0)
    expect(data.links).toHaveLength(0)
  })
})
