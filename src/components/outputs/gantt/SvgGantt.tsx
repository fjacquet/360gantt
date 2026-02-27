import type { ZoomScale } from '@store/assetStore'
import type { GanttTask } from '@/types/gantt'
import { computeTimeAxis, dateToX } from './timeAxis'

interface SvgGanttProps {
  tasks: GanttTask[]
  scales: ZoomScale[]
  dark?: boolean
}

const HEADER_HEIGHT = 48
const ROW_HEIGHT = 28
const BAR_HEIGHT = 16
const LABEL_COL = 260
const INDENT = 16
const BAR_PAD_Y = (ROW_HEIGHT - BAR_HEIGHT) / 2
const SUMMARY_BAR_HEIGHT = 8
const SUMMARY_PAD_Y = (ROW_HEIGHT - SUMMARY_BAR_HEIGHT) / 2

export function SvgGantt({ tasks, scales, dark = false }: SvgGanttProps) {
  const axis = computeTimeAxis(tasks, scales)
  const chartWidth = axis.totalWidth
  const totalWidth = LABEL_COL + chartWidth
  const totalHeight = HEADER_HEIGHT + tasks.length * ROW_HEIGHT

  if (tasks.length === 0 || chartWidth === 0) {
    return null
  }

  // Colors
  const bg = dark ? '#111827' : '#ffffff'
  const labelBg = dark ? '#1f2937' : '#f9fafb'
  const headerBg = dark ? '#1f2937' : '#f3f4f6'
  const textColor = dark ? '#e5e7eb' : '#374151'
  const textMuted = dark ? '#9ca3af' : '#6b7280'
  const gridLine = dark ? '#374151' : '#e5e7eb'
  const dividerLine = dark ? '#4b5563' : '#d1d5db'
  const stripeBg = dark ? '#1a2332' : '#f9fafb'
  const summaryBarColor = dark ? '#6b7280' : '#9ca3af'
  const todayColor = '#3b82f6'

  const today = new Date()

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={totalWidth}
      height={totalHeight}
      fontFamily="Inter, system-ui, -apple-system, sans-serif"
      fontSize={12}
    >
      <title>Gantt Chart</title>
      {/* Background */}
      <rect width={totalWidth} height={totalHeight} fill={bg} />

      {/* Alternating row stripes */}
      {tasks.map((_, i) => (
        i % 2 === 1 ? (
          <rect
            key={`stripe-${tasks[i]?.id}`}
            x={0}
            y={HEADER_HEIGHT + i * ROW_HEIGHT}
            width={totalWidth}
            height={ROW_HEIGHT}
            fill={stripeBg}
          />
        ) : null
      ))}

      {/* Vertical grid lines at column boundaries */}
      {axis.bottomRow.map((col) => (
        <line
          key={`vgrid-${col.x}`}
          x1={LABEL_COL + col.x}
          y1={HEADER_HEIGHT}
          x2={LABEL_COL + col.x}
          y2={totalHeight}
          stroke={gridLine}
          strokeWidth={0.5}
        />
      ))}

      {/* Horizontal row separators */}
      {tasks.map((_, i) => (
        <line
          key={`hgrid-${tasks[i]?.id}`}
          x1={0}
          y1={HEADER_HEIGHT + (i + 1) * ROW_HEIGHT}
          x2={totalWidth}
          y2={HEADER_HEIGHT + (i + 1) * ROW_HEIGHT}
          stroke={gridLine}
          strokeWidth={0.5}
        />
      ))}

      {/* Time axis header background */}
      <rect x={LABEL_COL} y={0} width={chartWidth} height={HEADER_HEIGHT} fill={headerBg} />

      {/* Top row headers */}
      {axis.topRow.map((col) => (
        <g key={`top-${col.x}`}>
          <line
            x1={LABEL_COL + col.x}
            y1={0}
            x2={LABEL_COL + col.x}
            y2={HEADER_HEIGHT / 2}
            stroke={dividerLine}
            strokeWidth={0.5}
          />
          <text
            x={LABEL_COL + col.x + col.width / 2}
            y={HEADER_HEIGHT / 4 + 4}
            textAnchor="middle"
            fill={textColor}
            fontSize={11}
            fontWeight={600}
          >
            {col.label}
          </text>
        </g>
      ))}

      {/* Bottom row headers */}
      {axis.bottomRow.map((col) => (
        <g key={`bot-${col.x}`}>
          <line
            x1={LABEL_COL + col.x}
            y1={HEADER_HEIGHT / 2}
            x2={LABEL_COL + col.x}
            y2={HEADER_HEIGHT}
            stroke={dividerLine}
            strokeWidth={0.5}
          />
          <text
            x={LABEL_COL + col.x + col.width / 2}
            y={HEADER_HEIGHT * 3 / 4 + 4}
            textAnchor="middle"
            fill={textMuted}
            fontSize={10}
          >
            {col.label}
          </text>
        </g>
      ))}

      {/* Header bottom border */}
      <line x1={0} y1={HEADER_HEIGHT} x2={totalWidth} y2={HEADER_HEIGHT} stroke={dividerLine} strokeWidth={1} />

      {/* Left panel background */}
      <rect x={0} y={0} width={LABEL_COL} height={totalHeight} fill={labelBg} />

      {/* Left panel header */}
      <rect x={0} y={0} width={LABEL_COL} height={HEADER_HEIGHT} fill={headerBg} />
      <text x={12} y={HEADER_HEIGHT / 2 + 4} fill={textColor} fontWeight={600} fontSize={12}>
        Asset / Product
      </text>

      {/* Clip path for label truncation */}
      <defs>
        <clipPath id="label-clip">
          <rect x={0} y={0} width={LABEL_COL - 8} height={totalHeight} />
        </clipPath>
      </defs>

      {/* Left panel text labels */}
      <g clipPath="url(#label-clip)">
        {tasks.map((task, i) => {
          const indent = task.parent === undefined || task.parent === 0
            ? 0
            : task.type === 'summary'
              ? INDENT
              : INDENT * 2
          return (
            <text
              key={`label-${task.id}`}
              x={8 + indent}
              y={HEADER_HEIGHT + i * ROW_HEIGHT + ROW_HEIGHT / 2 + 4}
              fill={textColor}
              fontSize={task.type === 'summary' ? 11 : 11}
              fontWeight={task.type === 'summary' ? 600 : 400}
            >
              {task.text}
            </text>
          )
        })}
      </g>

      {/* Task bars */}
      {tasks.map((task, i) => {
        const x1 = dateToX(task.start, axis.startDate, axis.endDate, chartWidth)
        const x2 = dateToX(task.end, axis.startDate, axis.endDate, chartWidth)
        const barWidth = Math.max(x2 - x1, 2)
        const isSummary = task.type === 'summary'

        if (isSummary) {
          return (
            <rect
              key={`bar-${task.id}`}
              x={LABEL_COL + x1}
              y={HEADER_HEIGHT + i * ROW_HEIGHT + SUMMARY_PAD_Y}
              width={barWidth}
              height={SUMMARY_BAR_HEIGHT}
              rx={2}
              fill={summaryBarColor}
              opacity={0.6}
            />
          )
        }

        return (
          <rect
            key={`bar-${task.id}`}
            x={LABEL_COL + x1}
            y={HEADER_HEIGHT + i * ROW_HEIGHT + BAR_PAD_Y}
            width={barWidth}
            height={BAR_HEIGHT}
            rx={3}
            fill={task.color ?? '#3b82f6'}
          />
        )
      })}

      {/* Today line */}
      {today >= axis.startDate && today <= axis.endDate && (
        <line
          x1={LABEL_COL + dateToX(today, axis.startDate, axis.endDate, chartWidth)}
          y1={HEADER_HEIGHT}
          x2={LABEL_COL + dateToX(today, axis.startDate, axis.endDate, chartWidth)}
          y2={totalHeight}
          stroke={todayColor}
          strokeWidth={1.5}
          strokeDasharray="4 3"
        />
      )}

      {/* Divider line between label panel and chart */}
      <line x1={LABEL_COL} y1={0} x2={LABEL_COL} y2={totalHeight} stroke={dividerLine} strokeWidth={1} />
    </svg>
  )
}
