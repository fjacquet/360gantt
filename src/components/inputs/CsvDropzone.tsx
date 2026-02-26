import { type DragEvent, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useCsvParse } from '@hooks/useCsvParse'
import { useAssetStore } from '@store/assetStore'

export function CsvDropzone() {
  const { t } = useTranslation()
  const { parseFile } = useCsvParse()
  const { loading } = useAssetStore()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const handleFile = (file: File | undefined) => {
    if (!file) return
    parseFile(file)
  }

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    handleFile(file)
  }

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(true)
  }

  const onDragLeave = () => setDragOver(false)

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFile(e.target.files?.[0])
    // Reset so same file can be re-selected
    e.target.value = ''
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={t('dropzone.title')}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
      className={[
        'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition-colors',
        dragOver
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
          : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50 dark:border-gray-600 dark:hover:border-blue-500 dark:hover:bg-gray-800',
      ].join(' ')}
    >
      <svg
        className="mb-3 h-10 w-10 text-gray-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 13.5l3 3m0 0l3-3m-3 3v-6m1.06-4.19l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z"
        />
      </svg>
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {loading ? t('dropzone.loading') : t('dropzone.title')}
      </p>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t('dropzone.subtitle')}</p>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        onChange={onInputChange}
      />
    </div>
  )
}
