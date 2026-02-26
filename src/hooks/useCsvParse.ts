import Papa from 'papaparse'
import { toast } from 'sonner'
import { resolveHeaders, toRawAsset } from '@engines/csv/headerResolver'
import { filterAssets } from '@engines/csv/assetFilter'
import { groupAssets } from '@engines/csv/assetGrouper'
import { toGanttData } from '@engines/csv/svarAdapter'
import { useAssetStore } from '@store/assetStore'

// Re-export so components don't need to import from multiple places
export { resolveHeaders, toRawAsset }

export function useCsvParse() {
  const { setLoading, setError, setData } = useAssetStore()

  const parseFile = (file: File) => {
    setLoading(true)

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete(results) {
        try {
          const rawHeaders = results.meta.fields ?? []
          const fieldMap = resolveHeaders(rawHeaders)

          const rawAssets = results.data.map((row) => toRawAsset(row, fieldMap))
          const parsed = filterAssets(rawAssets)

          if (parsed.length === 0) {
            toast.warning('No hardware assets with active contracts found in this file.')
            setError('No matching assets found.')
            return
          }

          const locationGroups = groupAssets(parsed)
          const ganttData = toGanttData(locationGroups)

          setData(locationGroups, ganttData, parsed.length, file.name)

          toast.success(
            `Loaded ${parsed.length} assets across ${locationGroups.length} locations`,
          )
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown parse error'
          setError(msg)
          toast.error(`Parse error: ${msg}`)
        }
      },
      error(err) {
        setError(err.message)
        toast.error(`File error: ${err.message}`)
      },
    })
  }

  return { parseFile }
}
