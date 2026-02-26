import { create } from 'zustand'
import type { GanttData } from '@/types/gantt'
import type { LocationGroup } from '@/types/asset'

export interface Filters {
  /** Location IDs to show; empty = show all */
  locationIds: string[]
  /** Free text search on product name */
  search: string
}

/** Zoom presets from widest (index 0) to finest (index 3) */
export interface ZoomScale {
  unit: string
  step: number
  format: string
}

export const ZOOM_PRESETS: { label: string; scales: ZoomScale[] }[] = [
  {
    label: '5-year',
    scales: [{ unit: 'year', step: 5, format: '%Y' }, { unit: 'year', step: 1, format: '%Y' }],
  },
  {
    label: 'Year',
    scales: [{ unit: 'year', step: 1, format: '%Y' }, { unit: 'month', step: 6, format: '%M' }],
  },
  {
    label: 'Quarter',
    scales: [{ unit: 'year', step: 1, format: '%Y' }, { unit: 'month', step: 3, format: '%M %Y' }],
  },
  {
    label: 'Month',
    scales: [{ unit: 'month', step: 1, format: '%M %Y' }, { unit: 'day', step: 7, format: '%j' }],
  },
]

/** Default zoom: quarterly view (index 2) */
const DEFAULT_ZOOM = 2

interface AssetState {
  loading: boolean
  error: string | null
  locationGroups: LocationGroup[]
  ganttData: GanttData
  filters: Filters
  totalAssets: number
  fileName: string | null
  /** Current index into ZOOM_PRESETS */
  zoomLevel: number

  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setData: (locationGroups: LocationGroup[], ganttData: GanttData, totalAssets: number, fileName: string) => void
  setFilters: (filters: Partial<Filters>) => void
  setZoom: (level: number) => void
  zoomIn: () => void
  zoomOut: () => void
  reset: () => void
}

const initialState = {
  loading: false,
  error: null,
  locationGroups: [],
  ganttData: { tasks: [], links: [] },
  filters: { locationIds: [], search: '' },
  totalAssets: 0,
  fileName: null,
  zoomLevel: DEFAULT_ZOOM,
}

export const useAssetStore = create<AssetState>()((set, get) => ({
  ...initialState,

  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error, loading: false }),

  setData: (locationGroups, ganttData, totalAssets, fileName) =>
    set({ locationGroups, ganttData, totalAssets, fileName, error: null, loading: false }),

  setFilters: (partial) =>
    set((state) => ({ filters: { ...state.filters, ...partial } })),

  setZoom: (level) =>
    set({ zoomLevel: Math.max(0, Math.min(ZOOM_PRESETS.length - 1, level)) }),

  zoomIn: () => {
    const { zoomLevel } = get()
    set({ zoomLevel: Math.min(ZOOM_PRESETS.length - 1, zoomLevel + 1) })
  },

  zoomOut: () => {
    const { zoomLevel } = get()
    set({ zoomLevel: Math.max(0, zoomLevel - 1) })
  },

  reset: () => set(initialState),
}))
