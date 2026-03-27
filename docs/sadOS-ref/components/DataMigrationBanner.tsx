import { useState } from 'react'
import { CloudUpload, Loader2, X, CheckCircle2, AlertTriangle } from 'lucide-react'
import { db } from '@/lib/db'
import { supabase, toDateStr, toTimestamp } from '@/lib/supabase'
import { useProjectStore } from '@/stores/useProjectStore'
import { useTodoStore } from '@/stores/useTodoStore'
import { useTalentStore } from '@/stores/useTalentStore'
import { useScratchStore } from '@/stores/useScratchStore'
import type { Project } from '@/types'

/* eslint-disable @typescript-eslint/no-explicit-any */

function projectToRow(p: Project): Record<string, any> {
  const { quotes, resources, id, name, client, status, driveUrl, shootingDate, deliveryDate, order, createdAt, updatedAt, ...rest } = p
  return {
    id,
    name,
    client,
    status,
    drive_url: driveUrl || null,
    shooting_date: toDateStr(shootingDate),
    delivery_date: toDateStr(deliveryDate),
    resources: resources || [],
    order_index: order ?? 0,
    created_at: toTimestamp(createdAt),
    updated_at: toTimestamp(updatedAt),
    data: {
      clientLogo: rest.clientLogo,
      domesticCountry: rest.domesticCountry,
      currency: rest.currency,
      secondaryCurrency: rest.secondaryCurrency,
      rateCardId: rest.rateCardId,
      mode: rest.mode,
      summaryLayout: rest.summaryLayout,
      preferences: rest.preferences,
      details: rest.details,
      accountLog: rest.accountLog,
      pettyCash: rest.pettyCash,
    },
  }
}

function quoteToRow(q: any, projectId: string): Record<string, any> {
  const { id, name, status, createdAt, updatedAt, projectId: _pid, ...rest } = q
  return {
    id,
    project_id: projectId,
    name,
    status,
    data: rest,
    created_at: toTimestamp(createdAt),
    updated_at: toTimestamp(updatedAt),
  }
}

/* eslint-enable @typescript-eslint/no-explicit-any */

interface MigrationReport {
  projects: number
  quotes: number
  todos: number
  talents: number
  notes: number
  errors: string[]
}

const DISMISSED_KEY = 'migration_dismissed'
const DONE_KEY = 'migration_done'

export function DataMigrationBanner() {
  const [hidden, setHidden] = useState(() =>
    localStorage.getItem(DISMISSED_KEY) === 'true' || localStorage.getItem(DONE_KEY) === 'true',
  )
  const [migrating, setMigrating] = useState(false)
  const [report, setReport] = useState<MigrationReport | null>(null)

  if (hidden) return null

  async function handleMigrate() {
    setMigrating(true)
    setReport(null)

    const result: MigrationReport = { projects: 0, quotes: 0, todos: 0, talents: 0, notes: 0, errors: [] }

    // 1. Projects + quotes
    try {
      const projects = await db.projects.toArray()
      if (projects.length > 0) {
        const projectRows = projects.map(projectToRow)
        const { error: pErr } = await supabase.from('projects').upsert(projectRows)
        if (pErr) {
          result.errors.push(`Projects: ${pErr.message}`)
        } else {
          result.projects = projects.length
        }

        const quoteRows = projects.flatMap((p) =>
          (p.quotes || []).map((q) => quoteToRow(q, p.id)),
        )
        if (quoteRows.length > 0) {
          const { error: qErr } = await supabase.from('quotes').upsert(quoteRows)
          if (qErr) {
            result.errors.push(`Devis: ${qErr.message}`)
          } else {
            result.quotes = quoteRows.length
          }
        }
      }
    } catch (err) {
      result.errors.push(`Projects: ${(err as Error).message}`)
    }

    // 2. Todos
    try {
      const todos = await db.todos.toArray()
      if (todos.length > 0) {
        const todoRows = todos.map((t) => ({
          id: t.id,
          text: t.text,
          done: t.done,
          project_id: t.projectId || null,
          talent_id: t.talentId || null,
          priority: t.priority || null,
          deadline: toDateStr(t.deadline),
          created_at: toTimestamp(t.createdAt),
        }))
        const { error: tErr } = await supabase.from('todos').upsert(todoRows)
        if (tErr) {
          result.errors.push(`Tâches: ${tErr.message}`)
        } else {
          result.todos = todos.length
        }
      }
    } catch (err) {
      result.errors.push(`Tâches: ${(err as Error).message}`)
    }

    // 3. Talents
    try {
      const talents = await db.talents.toArray()
      if (talents.length > 0) {
        const talentRows = talents.map((t) => ({
          id: t.id,
          name: t.name,
          category: t.category,
          status: t.status,
          instagram: t.instagram || null,
          website: t.website || null,
          vimeo: t.vimeo || null,
          photo: t.photo || null,
          notes: t.notes || null,
          project_ids: t.projectIds || [],
          presentations: t.presentations || [],
          status_history: t.statusHistory || [],
          order_index: t.order,
          created_at: toTimestamp(t.createdAt),
        }))
        const { error: tlErr } = await supabase.from('talents').upsert(talentRows)
        if (tlErr) {
          result.errors.push(`Talents: ${tlErr.message}`)
        } else {
          result.talents = talents.length
        }
      }
    } catch (err) {
      result.errors.push(`Talents: ${(err as Error).message}`)
    }

    // 4. Captures → scratch_notes
    try {
      const captures = await db.captures.toArray()
      if (captures.length > 0) {
        const noteRows = captures.map((c) => ({
          id: c.id,
          text: c.text,
          project_id: c.projectId || null,
          archived: c.archived,
          created_at: toTimestamp(c.createdAt),
        }))
        const { error: cErr } = await supabase.from('scratch_notes').upsert(noteRows)
        if (cErr) {
          result.errors.push(`Notes: ${cErr.message}`)
        } else {
          result.notes = captures.length
        }
      }
    } catch (err) {
      result.errors.push(`Notes: ${(err as Error).message}`)
    }

    // 5. Reload stores
    try {
      await useProjectStore.getState().init()
      await useTodoStore.getState().loadTodos()
      await useTalentStore.getState().loadTalents()
      await useScratchStore.getState().loadNotes()
    } catch {
      // silent
    }

    setReport(result)
    setMigrating(false)

    if (result.errors.length === 0) {
      localStorage.setItem(DONE_KEY, 'true')
    }
  }

  const hasErrors = report && report.errors.length > 0
  const totalImported = report ? report.projects + report.quotes + report.todos + report.talents + report.notes : 0

  return (
    <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50/60 p-4">
      <div className="flex items-start gap-3">
        <CloudUpload className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[13px] font-medium text-blue-900">
                Synchroniser les données locales
              </p>
              <p className="mt-1 text-[12px] text-blue-700">
                Envoyer les données du stockage local (IndexedDB) vers Supabase. Les données locales restent intactes comme backup.
              </p>
            </div>
            <button
              onClick={() => { localStorage.setItem(DISMISSED_KEY, 'true'); setHidden(true) }}
              className="shrink-0 rounded p-1 text-blue-400 transition-colors hover:bg-blue-100 hover:text-blue-600"
              title="Masquer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Report */}
          {report && (
            <div className={`mt-3 rounded-md border px-3 py-2 text-[12px] ${hasErrors ? 'border-amber-200 bg-amber-50' : 'border-green-200 bg-green-50'}`}>
              {totalImported > 0 && (
                <div className="flex items-center gap-1.5 text-green-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>
                    {[
                      report.projects > 0 && `${report.projects} projet${report.projects > 1 ? 's' : ''}`,
                      report.quotes > 0 && `${report.quotes} devis`,
                      report.todos > 0 && `${report.todos} tâche${report.todos > 1 ? 's' : ''}`,
                      report.talents > 0 && `${report.talents} talent${report.talents > 1 ? 's' : ''}`,
                      report.notes > 0 && `${report.notes} note${report.notes > 1 ? 's' : ''}`,
                    ]
                      .filter(Boolean)
                      .join(', ')}{' '}
                    importé{totalImported > 1 ? 's' : ''}
                  </span>
                </div>
              )}
              {totalImported === 0 && !hasErrors && (
                <p className="text-neutral-500">Aucune donnée locale à migrer.</p>
              )}
              {hasErrors && (
                <div className="mt-1.5 space-y-1">
                  {report.errors.map((err, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-amber-700">
                      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                      <span>{err}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <button
            onClick={handleMigrate}
            disabled={migrating}
            className="mt-3 inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {migrating ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Synchronisation en cours…
              </>
            ) : (
              <>
                <CloudUpload className="h-3.5 w-3.5" />
                Synchroniser les données locales → Supabase
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
