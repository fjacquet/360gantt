import { createHandlerBoundToURL } from 'workbox-precaching'
import { NavigationRoute, registerRoute, setCatchHandler, setDefaultHandler } from 'workbox-routing'
import { NetworkOnly } from 'workbox-strategies'

/**
 * Privacy-first runtime policy for the service worker:
 *  - SPA navigations are served from the precached app shell (works offline).
 *  - Everything else is NetworkOnly, so user CSV / asset data is never cached.
 */
export function installFetchGuard(): void {
  registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')))
  setDefaultHandler(new NetworkOnly())
  setCatchHandler(async () => Response.error())
}
