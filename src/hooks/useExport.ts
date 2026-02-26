import type { RefObject } from 'react'
import { toast } from 'sonner'

/**
 * Prepares the Gantt element for full-height capture:
 * - Resets CSS zoom (html2canvas doesn't handle it reliably)
 * - Releases the outer wrapper from its viewport-filling position
 * - Expands ALL descendants with overflow clipping so every row is in the DOM
 * - Dispatches a resize event so SVAR re-renders the newly visible rows
 * - Does NOT expand horizontal overflow on .wx-chart to avoid empty future-year columns
 *
 * Returns a cleanup function that restores every style change.
 */
function expandForCapture(el: HTMLElement): () => void {
  // biome-ignore lint/suspicious/noExplicitAny: zoom is a non-standard CSS property
  const style = el.style as any
  const prevZoom = (style.zoom as string) ?? ''
  style.zoom = '1'

  // Release the wrapper from position:absolute + inset:0 + height:100%
  // so that scrollHeight reflects content height, not viewport height.
  // Pin the offsetWidth explicitly: without this, switching from
  // position:absolute+inset:0 (width from inset) to position:relative
  // causes the container to lose its width, which collapses SVAR's
  // internal left-column panel behind the bar chart.
  const prevElWidth = el.style.width
  const prevElHeight = el.style.height
  const prevElMinHeight = el.style.minHeight
  const prevElPosition = el.style.position
  const prevElInset = el.style.inset
  const prevElOverflow = el.style.overflow
  el.style.width = `${el.offsetWidth}px`
  el.style.height = 'auto'
  el.style.minHeight = '0'
  el.style.position = 'relative'
  el.style.inset = 'auto'
  el.style.overflow = 'visible'

  // Expand every descendant that clips its content.
  // Skip horizontal overflow on .wx-chart — that container renders the full
  // time axis including empty future-year columns; keeping it clipped limits
  // the exported width to what's actually visible.
  type Snap = {
    el: HTMLElement
    overflow: string; overflowX: string; overflowY: string
    height: string; maxHeight: string; minHeight: string
  }
  const snaps: Snap[] = []

  el.querySelectorAll<HTMLElement>('*').forEach((s) => {
    const c = getComputedStyle(s)
    if (c.overflowY === 'visible' && c.overflowX === 'visible') return
    snaps.push({
      el: s,
      overflow: s.style.overflow,
      overflowX: s.style.overflowX,
      overflowY: s.style.overflowY,
      height: s.style.height,
      maxHeight: s.style.maxHeight,
      minHeight: s.style.minHeight,
    })
    s.style.overflowY = 'visible'
    // Keep horizontal clipping on .wx-chart to avoid empty year columns
    if (!s.classList.contains('wx-chart')) {
      s.style.overflowX = 'visible'
    }
    s.style.height = 'auto'
    s.style.maxHeight = 'none'
    s.style.minHeight = '0'
  })

  // Trigger SVAR to re-render rows that were previously outside the viewport
  window.dispatchEvent(new Event('resize'))

  return () => {
    style.zoom = prevZoom
    el.style.width = prevElWidth
    el.style.height = prevElHeight
    el.style.minHeight = prevElMinHeight
    el.style.position = prevElPosition
    el.style.inset = prevElInset
    el.style.overflow = prevElOverflow
    for (const { el: s, overflow, overflowX, overflowY, height, maxHeight, minHeight } of snaps) {
      s.style.overflow = overflow
      s.style.overflowX = overflowX
      s.style.overflowY = overflowY
      s.style.height = height
      s.style.maxHeight = maxHeight
      s.style.minHeight = minHeight
    }
    window.dispatchEvent(new Event('resize'))
  }
}

/**
 * Captures a DOM element as a PNG data URL at 2× resolution.
 * Uses clientWidth (visible columns only) × scrollHeight (all rows).
 */
async function captureElement(el: HTMLElement): Promise<string> {
  const { default: html2canvas } = await import('html2canvas')

  const restore = expandForCapture(el)

  // 150 ms gives SVAR time to respond to the resize event and render new rows
  await new Promise<void>((r) => setTimeout(r, 150))

  // clientWidth: visible columns only (avoids empty future-year columns)
  // scrollHeight: full content height after overflow expansion
  const w = el.clientWidth
  const h = el.scrollHeight

  let dataUrl: string
  try {
    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      width: w,
      height: h,
      windowWidth: w,
      windowHeight: h,
      scrollX: 0,
      scrollY: 0,
    })
    dataUrl = canvas.toDataURL('image/png')
  } finally {
    restore()
  }

  return dataUrl
}

/**
 * Load an Image from a data URL and return it once loaded.
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

export function useExport(ganttRef: RefObject<HTMLDivElement | null>) {
  const exportPdf = async () => {
    const el = ganttRef.current
    if (!el) return
    const toastId = toast.loading('Generating PDF…')
    try {
      const [{ default: jsPDF }, imgData] = await Promise.all([import('jspdf'), captureElement(el)])
      const img = await loadImage(imgData)

      // Custom page size: 1 CSS pixel = 1pt (72 dpi).
      // html2canvas captures at 2× so halve pixel count to get logical pt.
      const scale = 2
      const pageW = img.naturalWidth / scale   // pt
      const pageH = img.naturalHeight / scale  // pt

      // Page break unit: visible height of the element before expansion
      const visibleH = el.offsetHeight

      if (pageH <= visibleH * 1.1) {
        const doc = new jsPDF({
          orientation: pageW >= pageH ? 'landscape' : 'portrait',
          unit: 'pt',
          format: [pageW, pageH],
        })
        doc.addImage(imgData, 'PNG', 0, 0, pageW, pageH)
        doc.save('360gantt-export.pdf')
      } else {
        const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: [pageW, visibleH] })
        const slicePixels = Math.round(visibleH * scale)
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth

        let yPx = 0
        let page = 0
        while (yPx < img.naturalHeight) {
          const hPx = Math.min(slicePixels, img.naturalHeight - yPx)
          canvas.height = hPx
          const ctx = canvas.getContext('2d')
          if (ctx) {
            ctx.drawImage(img, 0, yPx, img.naturalWidth, hPx, 0, 0, img.naturalWidth, hPx)
            const slice = canvas.toDataURL('image/png')
            if (page > 0) doc.addPage([pageW, visibleH], 'landscape')
            doc.addImage(slice, 'PNG', 0, 0, pageW, hPx / scale)
          }
          yPx += hPx
          page++
        }
        doc.save('360gantt-export.pdf')
      }

      toast.success('PDF downloaded', { id: toastId })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Export failed'
      toast.error(msg, { id: toastId })
    }
  }

  const exportPptx = async () => {
    const el = ganttRef.current
    if (!el) return
    const toastId = toast.loading('Generating PPTX…')
    try {
      const [{ default: PptxGenJS }, imgData] = await Promise.all([
        import('pptxgenjs'),
        captureElement(el),
      ])
      const img = await loadImage(imgData)

      const pptx = new PptxGenJS()
      const scale = 2
      const inchW = img.naturalWidth / scale / 96
      const inchH = img.naturalHeight / scale / 96
      pptx.defineLayout({ name: 'GANTT', width: inchW, height: inchH })
      pptx.layout = 'GANTT'

      const slide = pptx.addSlide()
      slide.addImage({ data: imgData, x: 0, y: 0, w: inchW, h: inchH })
      await pptx.writeFile({ fileName: '360gantt-export.pptx' })
      toast.success('PPTX downloaded', { id: toastId })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Export failed'
      toast.error(msg, { id: toastId })
    }
  }

  const exportPng = async () => {
    const el = ganttRef.current
    if (!el) return
    const toastId = toast.loading('Generating PNG…')
    try {
      const imgData = await captureElement(el)
      const a = document.createElement('a')
      a.href = imgData
      a.download = '360gantt-export.png'
      a.click()
      toast.success('PNG downloaded', { id: toastId })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Export failed'
      toast.error(msg, { id: toastId })
    }
  }

  return { exportPdf, exportPptx, exportPng }
}
