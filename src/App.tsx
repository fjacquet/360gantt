import type { FallbackProps } from 'react-error-boundary'
import { ErrorBoundary } from 'react-error-boundary'
import { Toaster } from 'sonner'
import { AppShell } from '@components/layout/AppShell'

function ErrorFallback({ error }: FallbackProps) {
  const message = error instanceof Error ? error.message : String(error)
  return (
    <div className="flex h-screen items-center justify-center p-8 text-center">
      <div>
        <h2 className="mb-2 text-xl font-semibold text-red-600">Something went wrong</h2>
        <pre className="text-sm text-gray-500">{message}</pre>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <AppShell />
      <Toaster richColors position="bottom-right" />
    </ErrorBoundary>
  )
}
