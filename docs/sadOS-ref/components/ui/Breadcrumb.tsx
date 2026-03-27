import { Link } from 'react-router'

export interface BreadcrumbItem {
  label: string
  href?: string // omit for current page (last segment)
}

export function Breadcrumb({ items, className }: { items: BreadcrumbItem[]; className?: string }) {
  return (
    <nav className={`flex items-center gap-1.5 text-[13px] ${className ?? ''}`}>
      {items.map((item, i) => {
        const isLast = i === items.length - 1
        return (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-neutral-300">›</span>}
            {isLast || !item.href ? (
              <span className="font-medium text-neutral-900">{item.label}</span>
            ) : (
              <Link
                to={item.href}
                className="text-neutral-400 transition-colors hover:text-neutral-600"
              >
                {item.label}
              </Link>
            )}
          </span>
        )
      })}
    </nav>
  )
}
