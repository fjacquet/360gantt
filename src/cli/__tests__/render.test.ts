import { describe, expect, it } from 'vitest'
import { ZOOM_PRESETS } from '@store/assetStore'
import type { GanttTask } from '@/types/gantt'
import { renderGanttSvg } from '../render'

const tasks: GanttTask[] = [
  { id: 1, text: 'Geneva DC', start: new Date(2024, 0, 1), end: new Date(2027, 0, 1), type: 'summary', open: true },
  { id: 2, text: 'PowerEdge R740', start: new Date(2024, 0, 1), end: new Date(2027, 0, 1), type: 'task', parent: 1, color: '#0076ce' },
]

describe('renderGanttSvg', () => {
  it('returns an SVG string containing the chart and bar colour', () => {
    const scales = ZOOM_PRESETS[1]?.scales
    if (!scales) throw new Error('ZOOM_PRESETS[1] missing — test fixture broken')
    const svg = renderGanttSvg(tasks, scales)
    expect(svg).toContain('<svg')
    expect(svg).toContain('Asset / Product')
    expect(svg).toContain('#0076ce')
  })

  it('throws when there is nothing to render', () => {
    expect(() => renderGanttSvg([], ZOOM_PRESETS[1]?.scales ?? [])).toThrow(/nothing to render/i)
  })
})
