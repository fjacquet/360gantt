import { useRef } from 'react'
import { Header } from './Header'
import { CsvDropzone } from '@components/inputs/CsvDropzone'
import { FilterPanel } from '@components/inputs/FilterPanel'
import { GanttPanel } from '@components/outputs/GanttPanel'
import { EmptyState } from '@components/outputs/EmptyState'
import { useAssetStore } from '@store/assetStore'

export function AppShell() {
  const ganttRef = useRef<HTMLDivElement>(null)
  const { ganttData } = useAssetStore()
  const hasData = ganttData.tasks.length > 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Header ganttRef={ganttRef} />

      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {/* Left sidebar */}
        <aside
          style={{ width: 260, flexShrink: 0, overflowY: 'auto' }}
          className="border-r border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
        >
          <div className="flex flex-col gap-4">
            <CsvDropzone />
            <FilterPanel />
          </div>
        </aside>

        {/* Main content — must have explicit height for SVAR Gantt */}
        <main style={{ flex: 1, minWidth: 0, overflow: 'hidden', position: 'relative' }}>
          {hasData ? (
            <GanttPanel
              ref={ganttRef}
              style={{ position: 'absolute', inset: 0 }}
            />
          ) : (
            <EmptyState />
          )}
        </main>
      </div>
    </div>
  )
}
