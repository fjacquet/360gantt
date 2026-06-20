import type { GanttTask } from '@/types/gantt'

/** Maps a bar color to a Mermaid task status keyword. */
function colorToMermaidStatus(color: string | undefined): string {
  if (!color) return ''
  const c = color.toLowerCase()
  if (c === '#003b6f') return 'crit, ' // Dell dark blue = critical
  if (c === '#0076ce') return 'active, ' // Dell blue = warning
  if (c === '#9ca3af') return 'done, ' // gray = expired/done
  return '' // Dell light blue or unknown = default
}

function formatMermaidDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Converts the flat Gantt task array into a Mermaid `gantt` document. */
export function toMermaid(tasks: GanttTask[]): string {
  const lines: string[] = ['gantt', '  title 360gantt Export', '  dateFormat YYYY-MM-DD']

  for (const task of tasks) {
    if (task.type === 'summary' && (task.parent === 0 || task.parent === undefined)) {
      lines.push(`  section ${task.text}`)
      const products = tasks.filter((t) => t.parent === task.id && t.type === 'summary')
      for (const prod of products) {
        const assets = tasks.filter((t) => t.parent === prod.id && t.type === 'task')
        if (assets.length > 0) {
          for (const asset of assets) {
            const status = colorToMermaidStatus(asset.color)
            lines.push(
              `    ${asset.text} :${status}${formatMermaidDate(asset.start)}, ${formatMermaidDate(asset.end)}`,
            )
          }
        } else {
          const status = colorToMermaidStatus(prod.color)
          lines.push(
            `    ${prod.text} :${status}${formatMermaidDate(prod.start)}, ${formatMermaidDate(prod.end)}`,
          )
        }
      }
    }
  }

  return lines.join('\n')
}
