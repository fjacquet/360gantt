import { create } from 'zustand'
import type { GanttData } from '@/types/gantt'
import type { LocationGroup } from '@/types/asset'

export interface Filters {
  /** Location IDs to show; empty = show all */
  locationIds: string[]
  /** Free text search on product name */
  search: string
}

interface AssetState {
  /** True while CSV is being parsed */
  loading: boolean
  /** Parse/filter error message, if any */
  error: string | null
  /** All location groups from the loaded CSV */
  locationGroups: LocationGroup[]
  /** Adapted data for SVAR Gantt (filtered) */
  ganttData: GanttData
  /** Active filters */
  filters: Filters
  /** Total assets loaded (before filters) */
  totalAssets: number
  /** Name of the last loaded file */
  fileName: string | null

  // Actions
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setData: (locationGroups: LocationGroup[], ganttData: GanttData, totalAssets: number, fileName: string) => void
  setFilters: (filters: Partial<Filters>) => void
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
}

export const useAssetStore = create<AssetState>()((set) => ({
  ...initialState,

  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error, loading: false }),

  setData: (locationGroups, ganttData, totalAssets, fileName) =>
    set({ locationGroups, ganttData, totalAssets, fileName, error: null, loading: false }),

  setFilters: (partial) =>
    set((state) => ({ filters: { ...state.filters, ...partial } })),

  reset: () => set(initialState),
}))
