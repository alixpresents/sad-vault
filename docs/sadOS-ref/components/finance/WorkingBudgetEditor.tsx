import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useProjectStore } from '@/stores/useProjectStore'
import { calculateRowTotal, computeQuoteTotals, calculateMargin } from '@/engine/calculations'
import type { Project, Quote, QuoteRow, QuoteSection } from '@/types'

// ─── Helpers ────────────────────────────────────────────────────

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatPercent(value: number): string {
  return value.toLocaleString('fr-FR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
}

function wbRowTotal(wb: { qty: number | null; nb: number | null; rate: number | null }): number {
  return Math.round((wb.qty ?? 0) * (wb.nb ?? 0) * (wb.rate ?? 0))
}

/** Get the effective CS flag for a WB row: WB override if set, otherwise quote row value. */
function wbHasCS(row: QuoteRow): boolean {
  if (row.workingBudget && row.workingBudget.socialContributions != null) {
    return row.workingBudget.socialContributions
  }
  return row.socialContributions
}

const SECTION_LABELS: Record<string, string> = {
  A: 'Conception & Coordination',
  B: 'Production Image',
  C: 'Postproduction Image',
  D: 'Postproduction Son & Musique',
  E: 'Production Digitale',
  F: 'Postproduction Print',
  G: 'Service de Livraison Global',
  H: 'Repas, Hôtels & Per Diem',
  I: 'Voyages',
  J: 'Assurances',
  K: 'Cotisations Sociales',
}

const UNIT_LABELS: Record<string, string> = {
  day: 'Jour',
  fee: 'Forfait',
  hour: 'Heure',
  week: 'Semaine',
  month: 'Mois',
  unit: 'Unité',
  lot: 'Lot',
  km: 'Km',
  page: 'Page',
  custom: '—',
}

// ─── Number Cell ────────────────────────────────────────────────

function NumberCell({
  value,
  onChange,
  placeholder,
  className = '',
}: {
  value: number | null
  onChange: (v: number | null) => void
  placeholder?: string
  className?: string
}) {
  const [local, setLocal] = useState(value != null ? String(value) : '')
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) {
      setLocal(value != null ? String(value) : '')
    }
  }, [value, focused])

  return (
    <input
      type="text"
      inputMode="decimal"
      value={local}
      placeholder={placeholder}
      className={`w-full border-0 bg-transparent px-2 py-1.5 text-right font-mono text-[12px] tabular-nums outline-none placeholder:text-neutral-300 ${className}`}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false)
        const parsed = parseFloat(local.replace(',', '.'))
        onChange(local === '' || isNaN(parsed) ? null : parsed)
      }}
      onChange={(e) => setLocal(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
      }}
    />
  )
}

function RateCell({
  value,
  onChange,
  className = '',
}: {
  value: number | null
  onChange: (v: number | null) => void
  className?: string
}) {
  const euros = value != null ? value / 100 : null
  return (
    <NumberCell
      value={euros}
      onChange={(v) => onChange(v != null ? Math.round(v * 100) : null)}
      className={className}
    />
  )
}

// ─── WB Row ─────────────────────────────────────────────────────

interface WBRowProps {
  row: QuoteRow
  projectId: string
  quoteId: string
  sectionId: string
  subsectionId: string
  symbol: string
  isEven: boolean
}

const WB_GRID = 'minmax(180px,1fr) 36px 64px 64px 64px 90px 100px 90px 100px'

const WBRow = memo(function WBRow({
  row,
  projectId,
  quoteId,
  sectionId,
  subsectionId,
  symbol,
  isEven,
}: WBRowProps) {
  const updateWB = useProjectStore((s) => s.updateWorkingBudgetRow)

  const wb = row.workingBudget ?? { qty: row.qty, nb: row.nb, rate: row.rate }
  const hasCS = wbHasCS(row)
  const wbTotal = wbRowTotal(wb)
  const soldTotal = calculateRowTotal(row)
  const ecart = wbTotal - soldTotal

  const update = useCallback(
    (updates: Partial<{ qty: number | null; nb: number | null; rate: number | null; socialContributions: boolean }>) => {
      updateWB(projectId, quoteId, sectionId, subsectionId, row.id, updates)
    },
    [updateWB, projectId, quoteId, sectionId, subsectionId, row.id],
  )

  return (
    <div
      className={`grid items-center border-b border-neutral-100 ${isEven ? 'bg-neutral-50/50' : ''}`}
      style={{ gridTemplateColumns: WB_GRID }}
    >
      {/* Intitulé */}
      <div className="truncate px-3 py-1.5 text-[12px] text-neutral-700" title={row.title}>
        {row.title}
      </div>

      {/* CS checkbox */}
      <div className="flex items-center justify-center">
        <input
          type="checkbox"
          checked={hasCS}
          onChange={(e) => update({ socialContributions: e.target.checked })}
          title="Charges sociales"
          className="h-3.5 w-3.5 cursor-pointer rounded border-neutral-300 text-neutral-700 accent-neutral-700"
        />
      </div>

      {/* Qt WB */}
      <NumberCell value={wb.qty} onChange={(v) => update({ qty: v })} />

      {/* Nb WB */}
      <NumberCell value={wb.nb} onChange={(v) => update({ nb: v })} />

      {/* Unité */}
      <div className="px-2 py-1.5 text-[11px] text-neutral-400">
        {UNIT_LABELS[row.unit] ?? row.unit}
      </div>

      {/* Tarif WB */}
      <RateCell value={wb.rate} onChange={(v) => update({ rate: v })} />

      {/* Total WB */}
      <div className="px-2 py-1.5 text-right font-mono text-[12px] font-medium tabular-nums text-neutral-800">
        {wbTotal !== 0 ? `${formatCents(wbTotal)} ${symbol}` : ''}
      </div>

      {/* Tarif vendu */}
      <div className="px-2 py-1.5 text-right font-mono text-[11px] tabular-nums text-neutral-400">
        {row.rate != null && row.rate !== 0 ? formatCents(row.rate) : ''}
      </div>

      {/* Écart */}
      <div
        className={`px-2 py-1.5 text-right font-mono text-[12px] font-medium tabular-nums ${
          ecart < 0
            ? 'text-emerald-600'
            : ecart > 0
              ? 'text-orange-600'
              : 'text-neutral-400'
        }`}
      >
        {ecart !== 0 ? `${ecart > 0 ? '+' : ''}${formatCents(ecart)} ${symbol}` : '—'}
      </div>
    </div>
  )
})

// ─── WB Section ─────────────────────────────────────────────────

interface WBSectionProps {
  section: QuoteSection
  projectId: string
  quoteId: string
  symbol: string
  csRate: number
}

function WBSection({ section, projectId, quoteId, symbol, csRate }: WBSectionProps) {
  const [open, setOpen] = useState(true)

  // Collect active rows (total > 0 in quote)
  const activeRows: { row: QuoteRow; sectionId: string; subsectionId: string }[] = []
  for (const sub of section.subsections ?? []) {
    for (const row of sub.rows ?? []) {
      if (row.isNote || !row.isVisible) continue
      if (calculateRowTotal(row) <= 0) continue
      activeRows.push({ row, sectionId: section.id, subsectionId: sub.id })
    }
  }

  if (activeRows.length === 0) return null

  // Section WB total
  const sectionWBTotal = activeRows.reduce((sum, { row }) => {
    const wb = row.workingBudget ?? { qty: row.qty, nb: row.nb, rate: row.rate }
    return sum + wbRowTotal(wb)
  }, 0)

  // CS on WB rows that have socialContributions flag (using WB override)
  const sectionWBCS = activeRows.reduce((sum, { row }) => {
    if (!wbHasCS(row)) return sum
    const wb = row.workingBudget ?? { qty: row.qty, nb: row.nb, rate: row.rate }
    return sum + Math.round(wbRowTotal(wb) * csRate / 100)
  }, 0)

  const sectionSoldTotal = activeRows.reduce((sum, { row }) => sum + calculateRowTotal(row), 0)
  const sectionEcart = (sectionWBTotal + sectionWBCS) - sectionSoldTotal

  const label = SECTION_LABELS[section.code] ?? section.name

  return (
    <div className="mb-4">
      {/* Section header */}
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 rounded-t-lg border border-neutral-200 bg-neutral-100 px-3 py-2 text-left transition-colors hover:bg-neutral-200"
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 text-neutral-500" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-neutral-500" />
        )}
        <span className="text-[12px] font-bold text-neutral-700">{section.code}</span>
        <span className="flex-1 text-[12px] font-medium text-neutral-700">{label}</span>
        <span className="font-mono text-[12px] font-semibold tabular-nums text-neutral-700">
          {formatCents(sectionWBTotal + sectionWBCS)} {symbol}
        </span>
        {sectionWBCS > 0 && (
          <span className="ml-1 font-mono text-[10px] tabular-nums text-neutral-400">
            (dont CS {formatCents(sectionWBCS)})
          </span>
        )}
        <span
          className={`ml-2 font-mono text-[11px] tabular-nums ${
            sectionEcart < 0 ? 'text-emerald-600' : sectionEcart > 0 ? 'text-orange-600' : 'text-neutral-400'
          }`}
        >
          {sectionEcart !== 0
            ? `${sectionEcart > 0 ? '+' : ''}${formatCents(sectionEcart)}`
            : '—'}
        </span>
      </button>

      {open && (
        <div className="overflow-x-auto rounded-b-lg border border-t-0 border-neutral-200 bg-white">
          {/* Column headers */}
          <div
            className="grid border-b border-neutral-200 bg-neutral-50 px-0"
            style={{ gridTemplateColumns: WB_GRID }}
          >
            <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
              Intitulé
            </div>
            <div className="px-2 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wider text-neutral-500" title="Charges sociales">
              CS
            </div>
            <div className="px-2 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
              Qt
            </div>
            <div className="px-2 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
              Nb
            </div>
            <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
              Unité
            </div>
            <div className="px-2 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
              Tarif WB
            </div>
            <div className="px-2 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
              Total WB
            </div>
            <div className="px-2 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
              Tarif vendu
            </div>
            <div className="px-2 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
              Écart
            </div>
          </div>

          {/* Rows */}
          {activeRows.map(({ row, sectionId, subsectionId }, i) => (
            <WBRow
              key={row.id}
              row={row}
              projectId={projectId}
              quoteId={quoteId}
              sectionId={sectionId}
              subsectionId={subsectionId}
              symbol={symbol}
              isEven={i % 2 === 0}
            />
          ))}

          {/* CS summary line for this section */}
          {sectionWBCS > 0 && (
            <div
              className="grid items-center border-t border-neutral-200 bg-neutral-50/80"
              style={{ gridTemplateColumns: WB_GRID }}
            >
              <div className="px-3 py-1.5 text-[11px] font-medium italic text-neutral-500">
                Charges sociales estimées ({csRate}%)
              </div>
              <div />
              <div />
              <div />
              <div />
              <div />
              <div className="px-2 py-1.5 text-right font-mono text-[12px] font-medium tabular-nums text-neutral-600">
                {formatCents(sectionWBCS)} {symbol}
              </div>
              <div />
              <div />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main Editor ────────────────────────────────────────────────

interface WorkingBudgetEditorProps {
  project: Project
  quote: Quote
  symbol: string
}

export function WorkingBudgetEditor({ project, quote, symbol }: WorkingBudgetEditorProps) {
  const initWB = useProjectStore((s) => s.initializeWorkingBudget)

  // Pre-fill WB on first mount
  useEffect(() => {
    initWB(project.id, quote.id)
  }, [initWB, project.id, quote.id])

  // Compute totals
  const csRate = project.preferences.defaultSocialContributionsRate
  const mkRate = project.preferences.defaultMarkupRate
  const ovRate = project.preferences.defaultOverheadRate

  const totals = useMemo(() => {
    const t = computeQuoteTotals(quote.sections, csRate, mkRate, ovRate)
    const finalTotal = (quote.cutDownTo != null && quote.cutDownTo > 0) ? quote.cutDownTo : t.grandTotal

    // WB total = sum of all WB row totals (no OV/MK)
    let wbGrandTotal = 0
    let wbCSTotal = 0
    for (const section of quote.sections ?? []) {
      if (!section.isActive) continue
      for (const sub of section.subsections ?? []) {
        for (const row of sub.rows ?? []) {
          if (row.isNote || !row.isVisible) continue
          if (calculateRowTotal(row) <= 0) continue
          const wb = row.workingBudget ?? { qty: row.qty, nb: row.nb, rate: row.rate }
          const rowWB = wbRowTotal(wb)
          wbGrandTotal += rowWB
          if (wbHasCS(row)) {
            wbCSTotal += Math.round(rowWB * csRate / 100)
          }
        }
      }
    }

    const wbCostTotal = wbGrandTotal + wbCSTotal
    const margin = finalTotal - wbCostTotal
    const marginRate = finalTotal > 0 ? (margin / finalTotal) * 100 : 0

    return { finalTotal, wbGrandTotal, wbCSTotal, wbCostTotal, margin, marginRate }
  }, [quote, csRate, mkRate, ovRate])

  // Filter sections with active rows
  const activeSections = quote.sections.filter((section) => {
    if (!section.isActive) return false
    return section.subsections.some((sub) =>
      sub.rows.some((row) => !row.isNote && row.isVisible && calculateRowTotal(row) > 0),
    )
  })

  return (
    <div>
      {/* Summary cards */}
      <div className="mb-6 flex flex-wrap gap-4">
        <div className="rounded-lg border border-neutral-200 bg-white px-5 py-3 shadow-sm">
          <p className="text-[11px] uppercase tracking-wide text-neutral-500">Coût WB total</p>
          <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums text-neutral-900">
            {formatCents(totals.wbCostTotal)} {symbol}
          </p>
          {totals.wbCSTotal > 0 && (
            <p className="mt-0.5 text-[10px] text-neutral-500">
              dont CS : {formatCents(totals.wbCSTotal)} {symbol}
            </p>
          )}
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white px-5 py-3 shadow-sm">
          <p className="text-[11px] uppercase tracking-wide text-neutral-500">Total vendu</p>
          <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums text-neutral-900">
            {formatCents(totals.finalTotal)} {symbol}
          </p>
        </div>
        <div
          className={`rounded-lg border px-5 py-3 shadow-sm ${
            totals.margin < 0 ? 'border-red-300 bg-red-50' : 'border-neutral-200 bg-white'
          }`}
        >
          <p className="text-[11px] uppercase tracking-wide text-neutral-500">Marge prévisionnelle</p>
          <p
            className={`mt-0.5 font-mono text-lg font-semibold tabular-nums ${
              totals.margin < 0 ? 'text-red-600' : 'text-emerald-700'
            }`}
          >
            {formatCents(totals.margin)} {symbol}
            {totals.margin < 0 && (
              <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-red-700">
                À perte
              </span>
            )}
          </p>
        </div>
        <div
          className={`rounded-lg border px-5 py-3 shadow-sm ${
            totals.marginRate < 0 ? 'border-red-300 bg-red-50' : 'border-neutral-200 bg-white'
          }`}
        >
          <p className="text-[11px] uppercase tracking-wide text-neutral-500">Taux de marge</p>
          <p
            className={`mt-0.5 font-mono text-lg font-semibold tabular-nums ${
              totals.marginRate < 0 ? 'text-red-600' : 'text-emerald-700'
            }`}
          >
            {formatPercent(totals.marginRate)}%
          </p>
        </div>
      </div>

      {/* Sections */}
      {activeSections.map((section) => (
        <WBSection
          key={section.id}
          section={section}
          projectId={project.id}
          quoteId={quote.id}
          symbol={symbol}
          csRate={csRate}
        />
      ))}
    </div>
  )
}
