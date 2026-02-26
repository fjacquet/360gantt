import { toast } from 'sonner'

/**
 * Captures a DOM element as a PNG data URL using html2canvas.
 * Dynamic import keeps the heavy library out of the initial bundle.
 */
async function captureElement(el: HTMLElement): Promise<string> {
  const { default: html2canvas } = await import('html2canvas')
  const canvas = await html2canvas(el, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
  })
  return canvas.toDataURL('image/png')
}

export function useExport(ganttRef: React.RefObject<HTMLDivElement | null>) {
  const exportPdf = async () => {
    const el = ganttRef.current
    if (!el) return
    const toastId = toast.loading('Generating PDF…')
    try {
      const [{ default: jsPDF }, imgData] = await Promise.all([
        import('jspdf'),
        captureElement(el),
      ])
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      const pageW = doc.internal.pageSize.getWidth()
      const pageH = doc.internal.pageSize.getHeight()
      doc.addImage(imgData, 'PNG', 0, 0, pageW, pageH)
      doc.save('360gantt-export.pdf')
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
      const pptx = new PptxGenJS()
      pptx.layout = 'LAYOUT_WIDE'
      const slide = pptx.addSlide()
      slide.addImage({ data: imgData, x: 0, y: 0, w: '100%', h: '100%' })
      await pptx.writeFile({ fileName: '360gantt-export.pptx' })
      toast.success('PPTX downloaded', { id: toastId })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Export failed'
      toast.error(msg, { id: toastId })
    }
  }

  return { exportPdf, exportPptx }
}
