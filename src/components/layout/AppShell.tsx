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
    <div className="flex h-screen flex-col bg-gray-50 dark:bg-gray-950">
      <Header ganttRef={ganttRef} />

      <div className="flex min-h-0 flex-1">
        {/* Left sidebar */}
        <aside className="flex w-64 flex-shrink-0 flex-col gap-4 overflow-y-auto border-r border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          <CsvDropzone />
          <FilterPanel />
        </aside>

        {/* Main content */}
        <main className="min-w-0 flex-1 overflow-hidden">
          {hasData ? (
            <GanttPanel ref={ganttRef} className="h-full w-full" />
          ) : (
            <EmptyState />
          )}
        </main>
      </div>
    </div>
  )
}
