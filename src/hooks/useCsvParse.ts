import { toast } from 'sonner'
import { NoAssetsError, parseCsvToGantt } from '@engines/csv/pipeline'
import { useAssetStore } from '@store/assetStore'

export function useCsvParse() {
  const { setLoading, setError, setData } = useAssetStore()

  const parseFile = async (file: File) => {
    setLoading(true)
    try {
      const text = await file.text()
      const { ganttData, locationGroups, totalAssets, parseErrors } = parseCsvToGantt(text)
      setData(locationGroups, ganttData, totalAssets, file.name)
      toast.success(`Loaded ${totalAssets} assets across ${locationGroups.length} locations`)
      if (parseErrors.length > 0)
        toast.warning(`${parseErrors.length} row(s) had CSV formatting issues`)
    } catch (err) {
      if (err instanceof NoAssetsError) {
        toast.warning(err.message)
        setError('No matching assets found.')
        return
      }
      const msg = err instanceof Error ? err.message : 'Unknown parse error'
      setError(msg)
      toast.error(`Parse error: ${msg}`)
    }
  }

  return { parseFile }
}
