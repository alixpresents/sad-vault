import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Check, Lock, Plus, Trash2 } from 'lucide-react'
import { useProjectStore } from '@/stores/useProjectStore'
import { calculateRowTotal, computeQuoteTotals } from '@/engine/calculations'
import type { ExtraRow, Project, Quote, QuoteRow, QuoteSection, Unit } from '@/types'

// ─── Helpers ────────────────────────────────────────────────────

function fmt(cents: number): string {
  return (cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtPct(v: number): string {
  return v.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

function calcTotal(d: { qty: number | null; nb: number | null; rate: number | null }): number {
  return Math.round((d.qty ?? 0) * (d.nb ?? 0) * (d.rate ?? 0))
}

function getWB(row: QuoteRow) {
  return row.workingBudget ?? { qty: row.qty, nb: row.nb, rate: row.rate }
}

/** Effective cost for a quote row: totalOverride if set, otherwise Qt×Nb×Rate */
function effectiveCost(row: QuoteRow): number {
  const wb = row.workingBudget
  if (wb?.totalOverride != null) return wb.totalOverride
  return calcTotal(getWB(row))
}

/** Effective cost for an extra row */
function extraEffectiveCost(extra: ExtraRow): number {
  if (extra.totalOverride != null) return extra.totalOverride
  return calcTotal(extra)
}

function wbCS(row: QuoteRow): boolean {
  return row.workingBudget?.socialContributions ?? row.socialContributions
}

function isLocked(row: QuoteRow): boolean {
  return row.workingBudget?.locked === true
}

/** Is a row "active" (has nonzero total in quote)? */
function isActive(row: QuoteRow): boolean {
  return !row.isNote && row.isVisible && calculateRowTotal(row) > 0
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
  day: 'Jour', fee: 'Forfait', hour: 'Heure', week: 'Semaine', month: 'Mois',
  unit: 'Unité', lot: 'Lot', km: 'Km', page: 'Page', custom: '—',
}

const UNIT_OPTIONS: { value: Unit; label: string }[] = [
  { value: 'fee', label: 'Forfait' },
  { value: 'day', label: 'Jour' },
  { value: 'hour', label: 'Heure' },
  { value: 'unit', label: 'Unité' },
  { value: 'lot', label: 'Lot' },
  { value: 'week', label: 'Semaine' },
  { value: 'month', label: 'Mois' },
  { value: 'km', label: 'Km' },
  { value: 'page', label: 'Page' },
]

// ─── Editable cells ─────────────────────────────────────────────

function NumCell({ value, onChange, disabled, className = '' }: {
  value: number | null; onChange: (v: number | null) => void; disabled?: boolean; className?: string
}) {
  const [local, setLocal] = useState(value != null ? String(value) : '')
  const [focused, setFocused] = useState(false)

  useEffect(() => { if (!focused) setLocal(value != null ? String(value) : '') }, [value, focused])

  return (
    <input
      type="text" inputMode="decimal" value={local}
      disabled={disabled}
      className={`w-full border-0 bg-transparent px-1 py-1 text-right font-mono text-[11px] tabular-nums outline-none placeholder:text-neutral-300 ${disabled ? 'cursor-default text-neutral-400' : ''} ${className}`}
      onFocus={() => setFocused(true)}
      onBlur={() => { setFocused(false); const p = parseFloat(local.replace(',', '.')); onChange(local === '' || isNaN(p) ? null : p) }}
      onChange={(e) => setLocal(e.target.value)}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
    />
  )
}

function RateCell({ value, onChange, disabled, className = '' }: {
  value: number | null; onChange: (v: number | null) => void; disabled?: boolean; className?: string
}) {
  const euros = value != null ? value / 100 : null
  return <NumCell value={euros} onChange={(v) => onChange(v != null ? Math.round(v * 100) : null)} disabled={disabled} className={className} />
}

/** Inline-editable total cell (displays as text, becomes input on focus). Value in cents. */
function TotalCell({ value, onChange, disabled }: {
  value: number; onChange: (cents: number | null) => void; disabled?: boolean
}) {
  const euros = value / 100
  const [local, setLocal] = useState(euros !== 0 ? euros.toFixed(2) : '')
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) setLocal(euros !== 0 ? euros.toFixed(2) : '')
  }, [euros, focused])

  if (disabled) {
    return (
      <div className="px-1 py-1.5 text-right font-mono text-[11px] font-medium tabular-nums text-neutral-700">
        {value !== 0 ? fmt(value) : '—'}
      </div>
    )
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      value={focused ? local : (value !== 0 ? fmt(value) : '—')}
      className="w-full border-0 bg-transparent px-1 py-1.5 text-right font-mono text-[11px] font-medium tabular-nums text-neutral-700 outline-none focus:bg-white focus:ring-1 focus:ring-neutral-300 focus:rounded"
      onFocus={(e) => {
        setFocused(true)
        setLocal(euros !== 0 ? euros.toFixed(2) : '')
        // Select all on focus for easy replacement
        requestAnimationFrame(() => e.target.select())
      }}
      onBlur={() => {
        setFocused(false)
        const parsed = parseFloat(local.replace(',', '.').replace(/\s/g, ''))
        if (local === '' || isNaN(parsed)) {
          onChange(null)
        } else {
          onChange(Math.round(parsed * 100))
        }
      }}
      onChange={(e) => setLocal(e.target.value)}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
      onClick={(e) => e.stopPropagation()}
    />
  )
}

// ─── Compact grid ────────────────────────────────────────────────
// Déf | Intitulé | CS | Vendu | Coût | Écart

const COMPACT_GRID = '28px minmax(160px,1fr) 28px 90px 90px 90px'

// ─── Expanded detail grid ────────────────────────────────────────
// Label | Qt | Nb | Unité | Tarif | Total

const DETAIL_GRID = '80px 50px 50px 56px 72px 90px'

// ─── Follow-Up Row ──────────────────────────────────────────────

interface RowProps {
  row: QuoteRow
  projectId: string
  quoteId: string
  sectionId: string
  subsectionId: string
  symbol: string
  isEven: boolean
  readOnly?: boolean
}

const FollowUpRow = memo(function FollowUpRow({
  row, projectId, quoteId, sectionId, subsectionId, symbol, isEven, readOnly,
}: RowProps) {
  const updateWB = useProjectStore((s) => s.updateWorkingBudgetRow)
  const [expanded, setExpanded] = useState(false)

  const wb = getWB(row)
  const soldTotal = calculateRowTotal(row)
  const costTotal = effectiveCost(row)
  const csFlag = wbCS(row)
  const locked = isLocked(row)
  const ecart = costTotal - soldTotal
  const hasOverride = row.workingBudget?.totalOverride != null

  // Row is effectively read-only if globally readOnly OR locked
  const rowReadOnly = readOnly || locked

  const onWB = useCallback(
    (u: Partial<{ qty: number | null; nb: number | null; rate: number | null; socialContributions: boolean; locked: boolean; totalOverride: number | null }>) =>
      updateWB(projectId, quoteId, sectionId, subsectionId, row.id, u),
    [updateWB, projectId, quoteId, sectionId, subsectionId, row.id],
  )

  /** When user edits Qt/Nb/Rate in expand, clear totalOverride so calc takes over */
  const onWBDetail = useCallback(
    (u: Partial<{ qty: number | null; nb: number | null; rate: number | null }>) =>
      onWB({ ...u, totalOverride: null }),
    [onWB],
  )

  const ecartPct = soldTotal !== 0 ? Math.abs(ecart / soldTotal) * 100 : 0
  const ecartColor = ecart < 0
    ? 'text-emerald-600'
    : ecartPct > 20
      ? 'text-red-600'
      : ecart > 0
        ? 'text-orange-600'
        : 'text-neutral-400'

  return (
    <div className={locked ? 'bg-emerald-50/60' : isEven ? 'bg-neutral-50/50' : ''}>
      {/* Compact row */}
      <div
        className="grid items-center border-b border-neutral-100"
        style={{ gridTemplateColumns: COMPACT_GRID }}
      >
        {/* Définitif checkbox */}
        <div className="flex items-center justify-center">
          <input
            type="checkbox"
            checked={locked}
            onChange={(e) => onWB({ locked: e.target.checked })}
            disabled={readOnly}
            title="Définitif"
            className={`h-3 w-3 accent-emerald-600 ${readOnly ? 'cursor-default opacity-50' : 'cursor-pointer'}`}
          />
        </div>

        <div
          className="flex cursor-pointer items-center gap-1 truncate px-2 py-1.5 text-[11px] text-neutral-700"
          title={row.title}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded
            ? <ChevronDown className="h-3 w-3 shrink-0 text-neutral-400" />
            : <ChevronRight className="h-3 w-3 shrink-0 text-neutral-400" />
          }
          {locked && <Check className="h-3 w-3 shrink-0 text-emerald-600" />}
          <span className="truncate">{row.title}</span>
          {hasOverride && <span className="shrink-0 text-[8px] text-neutral-400" title="Total saisi manuellement">~</span>}
        </div>

        {/* CS */}
        <div className="flex items-center justify-center">
          <input type="checkbox" checked={csFlag}
            onChange={(e) => onWB({ socialContributions: e.target.checked })}
            disabled={rowReadOnly}
            title="Charges sociales" className={`h-3 w-3 accent-neutral-600 ${rowReadOnly ? 'cursor-default opacity-50' : 'cursor-pointer'}`} />
        </div>

        {/* Vendu */}
        <div className="px-1 py-1.5 text-right font-mono text-[11px] tabular-nums text-neutral-400">
          {soldTotal !== 0 ? fmt(soldTotal) : '—'}
        </div>

        {/* Coût — inline editable */}
        <TotalCell
          value={costTotal}
          disabled={rowReadOnly}
          onChange={(cents) => onWB({ totalOverride: cents })}
        />

        {/* Écart */}
        <div className={`px-1 py-1.5 text-right font-mono text-[11px] font-medium tabular-nums ${ecartColor}`}>
          {ecart !== 0 ? `${ecart > 0 ? '+' : ''}${fmt(ecart)}` : '—'}
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className={`border-b border-neutral-200 px-4 py-2 ${locked ? 'bg-emerald-50/40' : 'bg-neutral-50/80'}`}>
          <div className="grid gap-x-4 gap-y-1" style={{ gridTemplateColumns: DETAIL_GRID }}>
            {/* Header */}
            {['', 'Qt', 'Nb', 'Unité', 'Tarif', 'Total'].map((h) => (
              <div key={h} className="text-[9px] font-semibold uppercase tracking-wider text-neutral-400">{h}</div>
            ))}

            {/* Vendu (read-only) */}
            <div className="text-[10px] font-medium text-neutral-500">Vendu</div>
            <div className="text-right font-mono text-[10px] text-neutral-400">{row.qty ?? '—'}</div>
            <div className="text-right font-mono text-[10px] text-neutral-400">{row.nb ?? '—'}</div>
            <div className="text-[10px] text-neutral-400">{UNIT_LABELS[row.unit] ?? row.unit}</div>
            <div className="text-right font-mono text-[10px] text-neutral-400">{row.rate ? fmt(row.rate) : '—'}</div>
            <div className="text-right font-mono text-[10px] text-neutral-400">{soldTotal !== 0 ? fmt(soldTotal) : '—'}</div>

            {/* Coût */}
            <div className="text-[10px] font-medium text-neutral-600">Coût</div>
            {rowReadOnly ? (
              <>
                <div className="text-right font-mono text-[10px] text-neutral-500">{wb.qty ?? '—'}</div>
                <div className="text-right font-mono text-[10px] text-neutral-500">{wb.nb ?? '—'}</div>
              </>
            ) : (
              <>
                <div onClick={(e) => e.stopPropagation()}><NumCell value={wb.qty} onChange={(v) => onWBDetail({ qty: v })} /></div>
                <div onClick={(e) => e.stopPropagation()}><NumCell value={wb.nb} onChange={(v) => onWBDetail({ nb: v })} /></div>
              </>
            )}
            <div className="text-[10px] text-neutral-400 py-1">{UNIT_LABELS[row.unit] ?? row.unit}</div>
            {rowReadOnly ? (
              <div className="text-right font-mono text-[10px] text-neutral-500">{wb.rate ? fmt(wb.rate) : '—'}</div>
            ) : (
              <div onClick={(e) => e.stopPropagation()}><RateCell value={wb.rate} onChange={(v) => onWBDetail({ rate: v })} /></div>
            )}
            <div className="text-right font-mono text-[11px] font-medium text-neutral-700 py-1">
              {calcTotal(wb) !== 0 ? fmt(calcTotal(wb)) : '—'}
              {hasOverride && <span className="ml-1 text-[8px] text-neutral-400" title="Calcul Qt×Nb×Tarif">(calc)</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
})

// ─── Extra Row (hors devis) ──────────────────────────────────────

interface ExtraRowProps {
  extra: ExtraRow
  projectId: string
  symbol: string
  csRate: number
  isEven: boolean
  readOnly?: boolean
}

const ExtraFollowUpRow = memo(function ExtraFollowUpRow({
  extra, projectId, symbol, csRate, isEven, readOnly,
}: ExtraRowProps) {
  const updateExtra = useProjectStore((s) => s.updateExtraRow)
  const deleteExtra = useProjectStore((s) => s.deleteExtraRow)
  const [hovered, setHovered] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const locked = extra.locked === true
  const rowReadOnly = readOnly || locked
  const costRaw = extraEffectiveCost(extra)
  const csCost = extra.socialContributions ? Math.round(costRaw * csRate / 100) : 0
  const totalWithCS = costRaw + csCost
  const hasOverride = extra.totalOverride != null

  const [titleLocal, setTitleLocal] = useState(extra.title)
  const [titleFocused, setTitleFocused] = useState(false)
  useEffect(() => { if (!titleFocused) setTitleLocal(extra.title) }, [extra.title, titleFocused])

  /** When user edits Qt/Nb/Rate in expand, clear totalOverride */
  const onDetailUpdate = useCallback(
    (u: Partial<ExtraRow>) => updateExtra(projectId, extra.id, { ...u, totalOverride: null }),
    [updateExtra, projectId, extra.id],
  )

  return (
    <div
      className={`group ${locked ? 'bg-emerald-50/60' : isEven ? 'bg-neutral-50/50' : ''}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className="grid items-center border-b border-neutral-100"
        style={{ gridTemplateColumns: COMPACT_GRID }}
      >
        {/* Définitif checkbox */}
        <div className="flex items-center justify-center">
          <input
            type="checkbox"
            checked={locked}
            onChange={(e) => updateExtra(projectId, extra.id, { locked: e.target.checked })}
            disabled={readOnly}
            title="Définitif"
            className={`h-3 w-3 accent-emerald-600 ${readOnly ? 'cursor-default opacity-50' : 'cursor-pointer'}`}
          />
        </div>

        {/* Intitulé */}
        <div className="flex items-center gap-1 truncate px-2 py-1">
          <span
            className="cursor-pointer shrink-0"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded
              ? <ChevronDown className="h-3 w-3 text-neutral-400" />
              : <ChevronRight className="h-3 w-3 text-neutral-400" />
            }
          </span>
          {locked && <Check className="h-3 w-3 shrink-0 text-emerald-600" />}
          {rowReadOnly ? (
            <span className="truncate text-[11px] text-neutral-700">{extra.title || 'Sans titre'}</span>
          ) : (
            <input
              type="text"
              value={titleLocal}
              placeholder="Intitulé…"
              className="w-full min-w-0 border-0 bg-transparent text-[11px] text-neutral-700 outline-none placeholder:text-neutral-300"
              onFocus={() => setTitleFocused(true)}
              onBlur={() => { setTitleFocused(false); updateExtra(projectId, extra.id, { title: titleLocal }) }}
              onChange={(e) => setTitleLocal(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
            />
          )}
          <span className="shrink-0 rounded bg-orange-100 px-1 py-0.5 text-[8px] font-semibold uppercase text-orange-600">
            Hors devis
          </span>
          {hasOverride && <span className="shrink-0 text-[8px] text-neutral-400" title="Total saisi manuellement">~</span>}
          {/* Delete button on hover */}
          {hovered && !readOnly && (
            <button
              onClick={() => deleteExtra(projectId, extra.id)}
              className="shrink-0 rounded p-0.5 text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-500"
              title="Supprimer la dépense"
              aria-label="Supprimer la dépense"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* CS */}
        <div className="flex items-center justify-center">
          <input
            type="checkbox"
            checked={extra.socialContributions}
            onChange={(e) => updateExtra(projectId, extra.id, { socialContributions: e.target.checked })}
            disabled={rowReadOnly}
            title="Charges sociales"
            className={`h-3 w-3 accent-neutral-600 ${rowReadOnly ? 'cursor-default opacity-50' : 'cursor-pointer'}`}
          />
        </div>

        {/* Vendu — always empty for extra rows */}
        <div className="px-1 py-1.5 text-right font-mono text-[11px] tabular-nums text-neutral-300">
          —
        </div>

        {/* Coût — inline editable */}
        <TotalCell
          value={totalWithCS}
          disabled={rowReadOnly}
          onChange={(cents) => {
            // Store the override as the raw cost (before CS), since CS is computed on top
            if (cents == null) {
              updateExtra(projectId, extra.id, { totalOverride: null })
            } else {
              // The user typed the full amount; if CS is on, back out the CS to store the raw cost
              const raw = extra.socialContributions ? Math.round(cents / (1 + csRate / 100)) : cents
              updateExtra(projectId, extra.id, { totalOverride: raw })
            }
          }}
        />

        {/* Écart — pure cost, shown as negative */}
        <div className="px-1 py-1.5 text-right font-mono text-[11px] font-medium tabular-nums text-orange-600">
          {totalWithCS !== 0 ? `+${fmt(totalWithCS)}` : '—'}
        </div>
      </div>

      {/* Expanded detail — Qt/Nb/Unité/Tarif */}
      {expanded && !readOnly && !locked && (
        <div className="border-b border-neutral-200 bg-neutral-50/80 px-4 py-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <span className="text-[9px] font-semibold uppercase text-neutral-400">Qt</span>
              <div className="w-12"><NumCell value={extra.qty} onChange={(v) => onDetailUpdate({ qty: v })} /></div>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[9px] font-semibold uppercase text-neutral-400">Nb</span>
              <div className="w-12"><NumCell value={extra.nb} onChange={(v) => onDetailUpdate({ nb: v })} /></div>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[9px] font-semibold uppercase text-neutral-400">Unité</span>
              <select
                value={extra.unit}
                onChange={(e) => onDetailUpdate({ unit: e.target.value as Unit })}
                className="rounded border border-neutral-200 bg-white px-1 py-0.5 text-[10px] text-neutral-600 outline-none"
              >
                {UNIT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[9px] font-semibold uppercase text-neutral-400">Tarif</span>
              <div className="w-16"><RateCell value={extra.rate} onChange={(v) => onDetailUpdate({ rate: v })} /></div>
              <span className="text-[9px] text-neutral-400">{symbol}</span>
            </div>
            {hasOverride && (
              <span className="text-[9px] text-neutral-400 italic">Calcul : {fmt(calcTotal(extra))}</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
})

// ─── Section ────────────────────────────────────────────────────

interface SectionProps {
  section: QuoteSection
  projectId: string
  quoteId: string
  symbol: string
  csRate: number
  extraRows: ExtraRow[]
  readOnly?: boolean
}

function FollowUpSection({ section, projectId, quoteId, symbol, csRate, extraRows, readOnly }: SectionProps) {
  const [open, setOpen] = useState(true)
  const addExtraRow = useProjectStore((s) => s.addExtraRow)

  const activeRows: { row: QuoteRow; sectionId: string; subsectionId: string }[] = []
  for (const sub of section.subsections ?? []) {
    for (const row of sub.rows ?? []) {
      if (!isActive(row)) continue
      activeRows.push({ row, sectionId: section.id, subsectionId: sub.id })
    }
  }

  const sectionExtras = extraRows.filter((r) => r.sectionCode === section.code)

  if (activeRows.length === 0 && sectionExtras.length === 0) return null

  let costRaw = 0, costCS = 0, sold = 0
  let lockedCount = activeRows.filter(({ row }) => isLocked(row)).length
  let totalCount = activeRows.length

  for (const { row } of activeRows) {
    const wbT = effectiveCost(row)
    costRaw += wbT
    sold += calculateRowTotal(row)
    if (wbCS(row)) costCS += Math.round(wbT * csRate / 100)
  }

  // Extra rows cost
  let extraCost = 0
  for (const extra of sectionExtras) {
    const et = extraEffectiveCost(extra)
    extraCost += et
    if (extra.socialContributions) extraCost += Math.round(et * csRate / 100)
    totalCount++
    if (extra.locked) lockedCount++
  }

  const costTotal = costRaw + costCS + extraCost
  const label = SECTION_LABELS[section.code] ?? section.name

  return (
    <div className="mb-3">
      {/* Header */}
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 rounded-t-lg border border-neutral-200 bg-neutral-100 px-3 py-2 text-left transition-colors hover:bg-neutral-200"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5 text-neutral-500" /> : <ChevronRight className="h-3.5 w-3.5 text-neutral-500" />}
        <span className="text-[11px] font-bold text-neutral-700">{section.code}</span>
        <span className="flex-1 text-[11px] font-medium text-neutral-700">{label}</span>

        {/* Lock progress */}
        {lockedCount > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
            <Lock className="h-2.5 w-2.5" />
            {lockedCount}/{totalCount}
          </span>
        )}

        {sectionExtras.length > 0 && (
          <span className="rounded bg-orange-100 px-1.5 py-0.5 text-[9px] font-medium text-orange-600">
            +{sectionExtras.length} hors devis
          </span>
        )}

        <span className="font-mono text-[11px] tabular-nums text-neutral-400">{fmt(sold)}</span>
        <span className="ml-2 font-mono text-[11px] font-semibold tabular-nums text-neutral-700">{fmt(costTotal)}</span>
      </button>

      {open && (
        <div className="overflow-x-auto rounded-b-lg border border-t-0 border-neutral-200 bg-white">
          {/* Column headers */}
          <div className="grid border-b border-neutral-200 bg-neutral-50" style={{ gridTemplateColumns: COMPACT_GRID }}>
            <div className="px-1 py-1 text-center text-[9px] font-semibold uppercase tracking-wider text-neutral-400" title="Définitif">Déf</div>
            <div className="px-2 py-1 text-[9px] font-semibold uppercase tracking-wider text-neutral-500">Intitulé</div>
            <div className="px-1 py-1 text-center text-[9px] font-semibold uppercase tracking-wider text-neutral-400" title="Charges sociales">CS</div>
            <div className="px-1 py-1 text-right text-[9px] font-semibold uppercase tracking-wider text-neutral-400">Vendu</div>
            <div className="px-1 py-1 text-right text-[9px] font-semibold uppercase tracking-wider text-neutral-500">Coût</div>
            <div className="px-1 py-1 text-right text-[9px] font-semibold uppercase tracking-wider text-neutral-500">Écart</div>
          </div>

          {/* Quote rows */}
          {activeRows.map(({ row, sectionId, subsectionId }, i) => (
            <FollowUpRow
              key={row.id}
              row={row}
              projectId={projectId}
              quoteId={quoteId}
              sectionId={sectionId}
              subsectionId={subsectionId}
              symbol={symbol}
              isEven={i % 2 === 0}
              readOnly={readOnly}
            />
          ))}

          {/* Extra rows (hors devis) */}
          {sectionExtras.map((extra, i) => (
            <ExtraFollowUpRow
              key={extra.id}
              extra={extra}
              projectId={projectId}
              symbol={symbol}
              csRate={csRate}
              isEven={(activeRows.length + i) % 2 === 0}
              readOnly={readOnly}
            />
          ))}

          {/* CS summary */}
          {costCS > 0 && (
            <div className="grid items-center border-t border-neutral-200 bg-neutral-50/80" style={{ gridTemplateColumns: COMPACT_GRID }}>
              <div />
              <div className="px-2 py-1.5 text-[10px] font-medium italic text-neutral-500">
                Charges sociales ({csRate}%)
              </div>
              <div />
              <div />
              <div className="px-1 py-1.5 text-right font-mono text-[11px] tabular-nums text-neutral-600">
                {fmt(costCS)}
              </div>
              <div />
            </div>
          )}

          {/* Add extra row button */}
          {!readOnly && (
            <button
              onClick={() => addExtraRow(projectId, section.code)}
              className="flex w-full items-center gap-1.5 border-t border-dashed border-neutral-200 px-3 py-2 text-[11px] text-neutral-400 transition-colors hover:bg-neutral-50 hover:text-neutral-600"
            >
              <Plus className="h-3 w-3" />
              Ajouter une dépense hors devis
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main component ─────────────────────────────────────────────

interface FollowUpEditorProps {
  project: Project
  quote: Quote
  symbol: string
  readOnly?: boolean
}

export function FollowUpEditor({ project, quote, symbol, readOnly }: FollowUpEditorProps) {
  const initWB = useProjectStore((s) => s.initializeWorkingBudget)

  useEffect(() => {
    initWB(project.id, quote.id)
  }, [initWB, project.id, quote.id])

  const csRate = project.preferences.defaultSocialContributionsRate
  const mkRate = project.preferences.defaultMarkupRate
  const ovRate = project.preferences.defaultOverheadRate
  const extraRows = project.extraRows ?? []

  const totals = useMemo(() => {
    const t = computeQuoteTotals(quote.sections, csRate, mkRate, ovRate)
    const finalTotal = (quote.cutDownTo != null && quote.cutDownTo > 0) ? quote.cutDownTo : t.grandTotal

    let costRaw = 0, costCS = 0
    let lockedRows = 0, totalRows = 0

    for (const section of quote.sections ?? []) {
      if (!section.isActive) continue
      for (const sub of section.subsections ?? []) {
        for (const row of sub.rows ?? []) {
          if (!isActive(row)) continue
          totalRows++
          if (isLocked(row)) lockedRows++
          const wbT = effectiveCost(row)
          costRaw += wbT
          if (wbCS(row)) costCS += Math.round(wbT * csRate / 100)
        }
      }
    }

    // Extra rows
    let extraCostTotal = 0
    for (const extra of extraRows) {
      totalRows++
      if (extra.locked) lockedRows++
      const et = extraEffectiveCost(extra)
      extraCostTotal += et
      if (extra.socialContributions) extraCostTotal += Math.round(et * csRate / 100)
    }

    const cost = costRaw + costCS + extraCostTotal
    const margin = finalTotal - cost
    const marginRate = finalTotal > 0 ? (margin / finalTotal) * 100 : 0
    const lockedPct = totalRows > 0 ? Math.round((lockedRows / totalRows) * 100) : 0

    return { finalTotal, cost, costCS, margin, marginRate, lockedRows, totalRows, lockedPct, extraCostTotal }
  }, [quote, csRate, mkRate, ovRate, extraRows])

  const activeSections = quote.sections.filter((s) =>
    s.isActive && (
      s.subsections.some((sub) => sub.rows.some(isActive)) ||
      extraRows.some((r) => r.sectionCode === s.code)
    ),
  )

  const neg = totals.margin < 0

  return (
    <div>
      {readOnly && (
        <div className="mb-4 rounded-lg border border-neutral-300 bg-neutral-100 px-4 py-2.5 text-[12px] text-neutral-500">
          Projet clôturé — données figées
        </div>
      )}

      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-4 gap-3">
        <div className="rounded-lg border border-neutral-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-[10px] uppercase tracking-wide text-neutral-500">Total vendu</p>
          <p className="mt-0.5 font-mono text-base font-semibold tabular-nums text-neutral-900">{fmt(totals.finalTotal)} {symbol}</p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-[10px] uppercase tracking-wide text-neutral-500">Coût</p>
          <p className="mt-0.5 font-mono text-base font-semibold tabular-nums text-neutral-900">{fmt(totals.cost)} {symbol}</p>
          {totals.costCS > 0 && <p className="mt-0.5 text-[9px] text-neutral-400">dont CS {fmt(totals.costCS)}</p>}
          {totals.extraCostTotal > 0 && <p className="mt-0.5 text-[9px] text-orange-500">dont {fmt(totals.extraCostTotal)} hors devis</p>}
        </div>
        <div className={`rounded-lg border px-4 py-3 shadow-sm ${neg ? 'border-red-300 bg-red-50' : 'border-neutral-200 bg-white'}`}>
          <p className="text-[10px] uppercase tracking-wide text-neutral-500">Marge</p>
          <p className={`mt-0.5 font-mono text-base font-semibold tabular-nums ${neg ? 'text-red-600' : 'text-emerald-700'}`}>
            {fmt(totals.margin)} {symbol}
            {neg && <span className="ml-1.5 rounded bg-red-100 px-1 py-0.5 text-[9px] font-semibold uppercase text-red-700">À perte</span>}
          </p>
          <p className={`mt-0.5 font-mono text-[11px] tabular-nums ${neg ? 'text-red-500' : 'text-emerald-600'}`}>
            {fmtPct(totals.marginRate)}%
          </p>
        </div>
        {/* Locked progress card */}
        <div className="rounded-lg border border-neutral-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-[10px] uppercase tracking-wide text-neutral-500">Verrouillé</p>
          <p className="mt-0.5 font-mono text-base font-semibold tabular-nums text-emerald-700">
            {totals.lockedPct}%
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-100">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${totals.lockedPct}%` }}
              />
            </div>
            <span className="text-[9px] tabular-nums text-neutral-500">
              {totals.lockedRows}/{totals.totalRows}
            </span>
          </div>
        </div>
      </div>

      {/* Sections */}
      {activeSections.map((section) => (
        <FollowUpSection
          key={section.id}
          section={section}
          projectId={project.id}
          quoteId={quote.id}
          symbol={symbol}
          csRate={csRate}
          extraRows={extraRows}
          readOnly={readOnly}
        />
      ))}
    </div>
  )
}
