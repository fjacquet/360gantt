import Papa from 'papaparse'
import type { LocationGroup } from '@/types/asset'
import type { GanttData } from '@/types/gantt'
import { filterAssets, toRawAsset } from './assetFilter'
import { groupAssets } from './assetGrouper'
import { resolveHeaders } from './headerResolver'
import { toGanttData } from './svarAdapter'

export interface ParseResult {
  ganttData: GanttData
  locationGroups: LocationGroup[]
  totalAssets: number
  parseErrors: string[]
}

/** Thrown when the CSV parses but contains no hardware/active assets. */
export class NoAssetsError extends Error {
  constructor(message = 'No hardware assets with active contracts found in this file.') {
    super(message)
    this.name = 'NoAssetsError'
  }
}

/**
 * Pure CSV → Gantt pipeline shared by the web hook and the CLI.
 * Throws on unrecognised headers (via resolveHeaders) and NoAssetsError
 * when the filter removes every row.
 */
export function parseCsvToGantt(csvText: string): ParseResult {
  const results = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  })
  const parseErrors = results.errors.map((e) => e.message)
  const rawHeaders = results.meta.fields ?? []
  const fieldMap = resolveHeaders(rawHeaders)
  const rawAssets = results.data.map((row) => toRawAsset(row, fieldMap))
  const parsed = filterAssets(rawAssets)
  if (parsed.length === 0) {
    throw new NoAssetsError()
  }
  const locationGroups = groupAssets(parsed)
  const ganttData = toGanttData(locationGroups)
  return { ganttData, locationGroups, totalAssets: parsed.length, parseErrors }
}
