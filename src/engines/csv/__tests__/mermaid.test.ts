import { describe, expect, it } from 'vitest'
import type { GanttTask } from '@/types/gantt'
import { toMermaid } from '../mermaid'

const tasks: GanttTask[] = [
  { id: 1, text: 'Main DC', start: new Date(2024, 0, 1), end: new Date(2027, 0, 1), type: 'summary' },
  { id: 2, text: 'PowerEdge R740', start: new Date(2024, 0, 1), end: new Date(2027, 0, 1), type: 'summary', parent: 1 },
  { id: 3, text: 'R740 (A1)', start: new Date(2024, 0, 1), end: new Date(2026, 5, 30), type: 'task', parent: 2, color: '#0076ce' },
]

describe('toMermaid', () => {
  it('starts a gantt document with a section per location', () => {
    const out = toMermaid(tasks)
    expect(out.startsWith('gantt')).toBe(true)
    expect(out).toContain('section Main DC')
  })

  it('emits an active status for the Dell blue bar', () => {
    expect(toMermaid(tasks)).toContain('active, 2024-01-01, 2026-06-30')
  })

  it('returns an empty gantt for no tasks', () => {
    expect(toMermaid([])).toContain('gantt')
  })
})
