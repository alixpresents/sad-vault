import { useState, useRef, useEffect } from 'react'
import { ExternalLink, FolderPlus, Pencil } from 'lucide-react'
import { useProjectStore } from '@/stores/useProjectStore'
import { sanitizeUrl } from '@/lib/sanitizeUrl'

// Inline SVG for Google Drive icon (no dependency)
function DriveIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M7.71 3.5L1.15 15l3.43 5.95h6.86L4.88 8.47 7.71 3.5z" fill="#0066DA" />
      <path d="M16.29 3.5H9.43l6.56 11.5h7.16L16.29 3.5z" fill="#00AC47" />
      <path d="M1.15 15l3.43 5.95h14.84l3.43-5.95H1.15z" fill="#FFBA00" />
    </svg>
  )
}

/**
 * DriveLink — displays a Google Drive icon (clickable) or an "add" button.
 * Clicking the pencil or the "add" button opens an inline URL editor.
 */
export function DriveLink({
  projectId,
  driveUrl,
  size = 'sm',
}: {
  projectId: string
  driveUrl?: string
  size?: 'sm' | 'md'
}) {
  const updateProjectDriveUrl = useProjectStore((s) => s.updateProjectDriveUrl)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) {
      setDraft(driveUrl ?? '')
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [editing, driveUrl])

  const save = () => {
    const trimmed = draft.trim()
    updateProjectDriveUrl(projectId, trimmed || undefined)
    setEditing(false)
  }

  const iconSize = size === 'md' ? 'h-4 w-4' : 'h-3.5 w-3.5'
  const textSize = size === 'md' ? 'text-[12px]' : 'text-[11px]'

  if (editing) {
    return (
      <div className="flex items-center gap-1.5" onClick={(e) => e.preventDefault()}>
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === 'Enter') inputRef.current?.blur()
            if (e.key === 'Escape') setEditing(false)
          }}
          placeholder="https://drive.google.com/..."
          className={`w-56 rounded border border-neutral-300 bg-white px-2 py-0.5 ${textSize} outline-none focus:border-blue-400`}
        />
      </div>
    )
  }

  if (driveUrl) {
    return (
      <span className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <a
          href={sanitizeUrl(driveUrl)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded px-1 py-0.5 transition-colors hover:bg-blue-50"
          title="Ouvrir le dossier Drive"
          onClick={(e) => e.stopPropagation()}
        >
          <DriveIcon className={iconSize} />
          <ExternalLink className="h-2.5 w-2.5 text-neutral-400" />
        </a>
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditing(true) }}
          className="rounded p-0.5 text-neutral-300 transition-colors hover:bg-neutral-100 hover:text-neutral-500"
          title="Modifier le lien Drive"
        >
          <Pencil className="h-2.5 w-2.5" />
        </button>
      </span>
    )
  }

  return (
    <button
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditing(true) }}
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 ${textSize} text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600`}
      title="Lier un dossier Drive"
    >
      <FolderPlus className="h-3 w-3" />
      Drive
    </button>
  )
}
