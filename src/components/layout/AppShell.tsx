import { EmptyState } from '@components/outputs/EmptyState'
import { GanttPanel } from '@components/outputs/GanttPanel'
import { useAssetStore } from '@store/assetStore'
import { useRef } from 'react'
import { Header } from './Header'

export function AppShell() {
  const ganttRef = useRef<HTMLDivElement>(null)
  const { ganttData } = useAssetStore()
  const hasData = ganttData.tasks.length > 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Header ganttRef={ganttRef} />

      {/* Main content — full width, must have explicit height for SVAR Gantt */}
      <main style={{ flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative' }}>
        {hasData ? <GanttPanel ref={ganttRef} /> : <EmptyState />}
      </main>
    </div>
  )
}
