import { registerSW } from 'virtual:pwa-register'
import { toast } from 'sonner'

/** Registers the service worker and prompts the user to reload on update. */
export function setupPWA(): void {
  const updateSW = registerSW({
    onNeedRefresh() {
      toast('A new version is available.', {
        action: { label: 'Reload', onClick: () => void updateSW(true) },
        duration: Number.POSITIVE_INFINITY,
      })
    },
    onOfflineReady() {
      toast.success('Ready to work offline.')
    },
  })
}
