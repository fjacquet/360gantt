import { type RefObject, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ZOOM_PRESETS, SCALE_STEPS, useAssetStore } from '@store/assetStore'
import { useExport } from '@hooks/useExport'
import { CsvDropzone } from '@components/inputs/CsvDropzone'
import { FilterPanel } from '@components/inputs/FilterPanel'
import i18n from '@/i18n/config'

interface HeaderProps {
  ganttRef: RefObject<HTMLDivElement | null>
}

export function Header({ ganttRef }: HeaderProps) {
  const { t } = useTranslation()
  const { ganttData, totalAssets, locationGroups, zoomLevel, zoomIn, zoomOut, scaleIdx, scaleUp, scaleDown } =
    useAssetStore()
  const { exportPng, exportPdf, exportPptx } = useExport(ganttRef)
  const hasData = ganttData.tasks.length > 0
  const [filterOpen, setFilterOpen] = useState(false)
  const filterRef = useRef<HTMLDivElement>(null)

  const LANGS = ['en', 'fr', 'it', 'de'] as const
  const currentLang = LANGS.find((l) => i18n.language.startsWith(l)) ?? 'en'
  const nextLang = LANGS[(LANGS.indexOf(currentLang) + 1) % LANGS.length] ?? 'en'
  const toggleLang = () => i18n.changeLanguage(nextLang).catch(console.error)

  const currentZoomLabel = ZOOM_PRESETS[zoomLevel]?.label ?? ''
  const canZoomIn = zoomLevel < ZOOM_PRESETS.length - 1
  const canZoomOut = zoomLevel > 0
  const scalePercent = Math.round((SCALE_STEPS[scaleIdx] ?? 1) * 100)
  const canScaleUp = scaleIdx < SCALE_STEPS.length - 1
  const canScaleDown = scaleIdx > 0

  return (
    <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-2 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-base font-bold leading-none text-blue-700 dark:text-blue-400">
            {t('app.title')}
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('app.subtitle')}</p>
        </div>

        {/* File upload — always visible */}
        <CsvDropzone compact />

        {/* Stats + filter when data is loaded */}
        {hasData && (
          <>
            <span className="hidden text-xs text-gray-500 sm:block dark:text-gray-400">
              {totalAssets} {t('gantt.assets')} · {locationGroups.length} {t('gantt.locations')}
            </span>

            {/* Filter dropdown */}
            <div ref={filterRef} className="relative">
              <button
                type="button"
                onClick={() => setFilterOpen((v) => !v)}
                className="flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
                </svg>
                {t('filter.locations')}
                <svg className={`h-3 w-3 transition-transform ${filterOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {filterOpen && (
                <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-lg border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-900">
                  <FilterPanel />
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Zoom controls */}
        {hasData && (
          <div className="flex items-center gap-1 rounded border border-gray-200 bg-gray-50 px-1 dark:border-gray-600 dark:bg-gray-800">
            <button
              type="button"
              onClick={zoomOut}
              disabled={!canZoomOut}
              title="Zoom out"
              className="rounded p-1 text-sm font-bold text-gray-600 hover:bg-gray-200 disabled:opacity-30 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              −
            </button>
            <span className="min-w-14 text-center text-xs font-medium text-gray-600 dark:text-gray-300">
              {currentZoomLabel}
            </span>
            <button
              type="button"
              onClick={zoomIn}
              disabled={!canZoomIn}
              title="Zoom in"
              className="rounded p-1 text-sm font-bold text-gray-600 hover:bg-gray-200 disabled:opacity-30 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              +
            </button>
          </div>
        )}

        {/* Visual scale controls */}
        {hasData && (
          <div className="flex items-center gap-1 rounded border border-gray-200 bg-gray-50 px-1 dark:border-gray-600 dark:bg-gray-800">
            <button
              type="button"
              onClick={scaleDown}
              disabled={!canScaleDown}
              title="Scale down"
              className="rounded p-1 text-sm font-bold text-gray-600 hover:bg-gray-200 disabled:opacity-30 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              −
            </button>
            <span className="min-w-10 text-center text-xs font-medium text-gray-600 dark:text-gray-300">
              {scalePercent}%
            </span>
            <button
              type="button"
              onClick={scaleUp}
              disabled={!canScaleUp}
              title="Scale up"
              className="rounded p-1 text-sm font-bold text-gray-600 hover:bg-gray-200 disabled:opacity-30 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              +
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={toggleLang}
          className="rounded px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          {nextLang.toUpperCase()}
        </button>

        {hasData && (
          <>
            <button
              type="button"
              onClick={exportPng}
              className="rounded bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
            >
              {t('header.exportPng')}
            </button>
            <button
              type="button"
              onClick={exportPdf}
              className="rounded bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
            >
              {t('header.exportPdf')}
            </button>
            <button
              type="button"
              onClick={exportPptx}
              className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
            >
              {t('header.exportPptx')}
            </button>
          </>
        )}
      </div>
    </header>
  )
}
