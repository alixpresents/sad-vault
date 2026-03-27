import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  subtitle?: string
  cta?: ReactNode
}

export function EmptyState({ icon, title, subtitle, cta }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed border-neutral-200 py-14 text-center">
      {icon && <div className="mb-3">{icon}</div>}
      <p className="text-[14px] font-medium text-neutral-500">{title}</p>
      {subtitle && (
        <p className="mt-1 text-[13px] text-neutral-400">{subtitle}</p>
      )}
      {cta && <div className="mt-4">{cta}</div>}
    </div>
  )
}
