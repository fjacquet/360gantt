import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { SvgGantt } from '@components/outputs/gantt/SvgGantt'
import type { ZoomScale } from '@store/assetStore'
import type { GanttTask } from '@/types/gantt'

export interface RenderOptions {
  dark?: boolean
}

/**
 * Server-renders the pure SvgGantt component to an SVG string.
 * Throws if the dataset produces no chart (SvgGantt returns null).
 */
export function renderGanttSvg(
  tasks: GanttTask[],
  scales: ZoomScale[],
  options: RenderOptions = {},
): string {
  const markup = renderToStaticMarkup(
    createElement(SvgGantt, { tasks, scales, dark: options.dark ?? false }),
  )
  if (!markup.includes('<svg')) {
    throw new Error('Nothing to render: the dataset produced no Gantt rows.')
  }
  return markup
}
