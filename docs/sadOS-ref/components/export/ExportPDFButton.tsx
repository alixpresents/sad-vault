import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import type { Project, Quote } from '@/types'
import { useCompanyStore } from '@/stores/useCompanyStore'
import {
  PDF_TEMPLATES,
  PDF_TEMPLATE_KEYS,
  getSavedTemplate,
  saveTemplate,
} from '@/pdf'

interface ExportPDFButtonProps {
  project: Project
  quote: Quote
  className?: string
}

const DEFAULT_INSTALLMENTS = [
  { percent: 50, description: '' },
  { percent: 30, description: '' },
  { percent: 20, description: '' },
]

export function ExportPDFButton({ project, quote, className = '' }: ExportPDFButtonProps) {
  const [loading, setLoading] = useState(false)
  const [templateKey, setTemplateKey] = useState(getSavedTemplate)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const companySettings = useCompanyStore((s) => s.settings)

  const hasMultipleTemplates = PDF_TEMPLATE_KEYS.length > 1

  const installmentsValid = useMemo(() => {
    const items = quote.paymentInstallments ?? DEFAULT_INSTALLMENTS
    const total = items.reduce((sum, i) => sum + i.percent, 0)
    return Math.abs(total - 100) < 0.01
  }, [quote.paymentInstallments])

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

  const handleSelectTemplate = useCallback((key: string) => {
    setTemplateKey(key)
    saveTemplate(key)
    setMenuOpen(false)
  }, [])

  const handleExport = useCallback(async () => {
    setLoading(true)
    try {
      const template = PDF_TEMPLATES[templateKey]
      const [{ pdf }, { default: PdfComponent }] = await Promise.all([
        import('@react-pdf/renderer'),
        template.load(),
      ])

      const blob = await pdf(
        <PdfComponent
          project={project}
          quote={quote}
          companyName={companySettings.companyName}
          companyContact={companySettings.companyContact}
          companyLogoUrl={companySettings.logoUrl}
        />,
      ).toBlob()

      // Build filename: project_quote.pdf (sanitized)
      const sanitize = (s: string) =>
        s.replace(/[^a-zA-Z0-9àâäéèêëïîôùûüÿçœæ _-]/g, '').replace(/\s+/g, '_')
      const filename = `${sanitize(project.name)}_${sanitize(quote.name)}.pdf`

      // Trigger download
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('PDF generation failed:', err)
    } finally {
      setLoading(false)
    }
  }, [project, quote, companySettings, templateKey])

  const disabled = loading || !installmentsValid
  const buttonStyle = 'rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-[12px] font-medium text-neutral-700 shadow-sm transition-colors hover:bg-neutral-50 disabled:opacity-50'

  // Single template — simple button, no dropdown
  if (!hasMultipleTemplates) {
    return (
      <button
        onClick={handleExport}
        disabled={disabled}
        title={!installmentsValid ? 'Les versements doivent totaliser 100%' : undefined}
        className={`${buttonStyle} ${className}`}
      >
        {loading ? 'Export...' : 'Exporter PDF'}
      </button>
    )
  }

  // Multiple templates — split button with dropdown
  return (
    <div ref={menuRef} className={`relative inline-flex ${className}`}>
      <button
        onClick={handleExport}
        disabled={disabled}
        title={!installmentsValid ? 'Les versements doivent totaliser 100%' : undefined}
        className={`${buttonStyle} rounded-r-none border-r-0`}
      >
        {loading ? 'Export...' : `Exporter PDF — ${PDF_TEMPLATES[templateKey].name}`}
      </button>
      <button
        onClick={() => setMenuOpen((v) => !v)}
        disabled={disabled}
        className={`${buttonStyle} rounded-l-none px-1.5`}
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>

      {menuOpen && (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-[160px] rounded-md border border-neutral-200 bg-white py-1 shadow-lg">
          {PDF_TEMPLATE_KEYS.map((key) => (
            <button
              key={key}
              onClick={() => handleSelectTemplate(key)}
              className={`block w-full px-3 py-1.5 text-left text-[12px] transition-colors hover:bg-neutral-50 ${
                key === templateKey ? 'font-semibold text-neutral-900' : 'text-neutral-600'
              }`}
            >
              {PDF_TEMPLATES[key].name}
              {key === templateKey && (
                <span className="ml-2 text-[10px] text-neutral-400">✓</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
