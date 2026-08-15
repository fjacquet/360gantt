import type { GanttTask } from '@/types/gantt'
import { toMermaid } from '../mermaid'

const tasks: GanttTask[] = [
  {
    id: 1,
    text: 'Main DC',
    start: new Date(2024, 0, 1),
    end: new Date(2027, 0, 1),
    type: 'summary',
  },
  {
    id: 2,
    text: 'PowerEdge R740',
    start: new Date(2024, 0, 1),
    end: new Date(2027, 0, 1),
    type: 'summary',
    parent: 1,
  },
  {
    id: 3,
    text: 'R740 (A1)',
    start: new Date(2024, 0, 1),
    end: new Date(2026, 5, 30),
    type: 'task',
    parent: 2,
    color: '#0076ce',
  },
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

  it('emits a crit status for the Dell dark-blue bar', () => {
    const t: GanttTask[] = [
      {
        id: 1,
        text: 'DC',
        start: new Date(2024, 0, 1),
        end: new Date(2027, 0, 1),
        type: 'summary',
      },
      {
        id: 2,
        text: 'Server',
        start: new Date(2024, 0, 1),
        end: new Date(2027, 0, 1),
        type: 'summary',
        parent: 1,
      },
      {
        id: 3,
        text: 'A1',
        start: new Date(2024, 0, 1),
        end: new Date(2025, 0, 1),
        type: 'task',
        parent: 2,
        color: '#003b6f',
      },
    ]
    expect(toMermaid(t)).toContain('crit, 2024-01-01, 2025-01-01')
  })

  it('emits a done status for the gray bar', () => {
    const t: GanttTask[] = [
      {
        id: 1,
        text: 'DC',
        start: new Date(2024, 0, 1),
        end: new Date(2027, 0, 1),
        type: 'summary',
      },
      {
        id: 2,
        text: 'Server',
        start: new Date(2024, 0, 1),
        end: new Date(2027, 0, 1),
        type: 'summary',
        parent: 1,
      },
      {
        id: 3,
        text: 'A1',
        start: new Date(2024, 0, 1),
        end: new Date(2025, 0, 1),
        type: 'task',
        parent: 2,
        color: '#9ca3af',
      },
    ]
    expect(toMermaid(t)).toContain('done, 2024-01-01, 2025-01-01')
  })

  it('emits no status keyword for an unknown bar colour', () => {
    const t: GanttTask[] = [
      {
        id: 1,
        text: 'DC',
        start: new Date(2024, 0, 1),
        end: new Date(2027, 0, 1),
        type: 'summary',
      },
      {
        id: 2,
        text: 'Server',
        start: new Date(2024, 0, 1),
        end: new Date(2027, 0, 1),
        type: 'summary',
        parent: 1,
      },
      {
        id: 3,
        text: 'A1',
        start: new Date(2024, 0, 1),
        end: new Date(2025, 0, 1),
        type: 'task',
        parent: 2,
        color: '#abcdef',
      },
    ]
    expect(toMermaid(t)).toContain('A1 :2024-01-01, 2025-01-01')
  })

  it('falls back to the product summary row when it has no child assets', () => {
    const t: GanttTask[] = [
      {
        id: 1,
        text: 'DC',
        start: new Date(2024, 0, 1),
        end: new Date(2027, 0, 1),
        type: 'summary',
      },
      {
        id: 2,
        text: 'Server',
        start: new Date(2024, 0, 1),
        end: new Date(2026, 0, 1),
        type: 'summary',
        parent: 1,
      },
    ]
    expect(toMermaid(t)).toContain('Server :2024-01-01, 2026-01-01')
  })

  it('sanitizes colons in location labels so they do not collide with the Mermaid label:date separator', () => {
    const t: GanttTask[] = [
      {
        id: 1,
        text: 'Site A: West',
        start: new Date(2024, 0, 1),
        end: new Date(2027, 0, 1),
        type: 'summary',
      },
      {
        id: 2,
        text: 'PowerEdge',
        start: new Date(2024, 0, 1),
        end: new Date(2027, 0, 1),
        type: 'summary',
        parent: 1,
      },
      {
        id: 3,
        text: 'SVC-001',
        start: new Date(2024, 0, 1),
        end: new Date(2027, 0, 1),
        type: 'task',
        parent: 2,
        color: '#0076ce',
      },
    ]
    const out = toMermaid(t)
    expect(out).toContain('section Site A  West')
    expect(out).not.toContain('section Site A: West')
  })
})
