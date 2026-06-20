/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching'
import { installFetchGuard } from './privacy/fetchGuard'

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>
}

precacheAndRoute(self.__WB_MANIFEST)
installFetchGuard()

// Prompt-for-update: registerSW posts SKIP_WAITING when the user clicks Reload.
self.addEventListener('message', (event) => {
  if (event.origin && event.origin !== self.location.origin) return
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting()
})
