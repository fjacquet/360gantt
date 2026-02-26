// Shape expected by @svar-ui/react-gantt
export interface GanttTask {
  id: number | string
  text: string
  start: Date
  end: Date
  duration?: number
  progress?: number
  type?: 'task' | 'summary' | 'milestone'
  parent?: number | string
  open?: boolean
  /** Custom: hex color for the bar */
  color?: string
}

export interface GanttLink {
  id: number | string
  source: number | string
  target: number | string
  type: 'e2e' | 'e2s' | 's2e' | 's2s'
}

export interface GanttData {
  tasks: GanttTask[]
  links: GanttLink[]
}
