import { useEffect, useState, useCallback, useRef } from 'react'
import { Outlet, NavLink, useLocation } from 'react-router'
import {
  LayoutDashboard,
  FileText,
  CheckSquare,
  Eye,
  TrendingUp,
  MoreHorizontal,
  Settings,
  CreditCard,
  LogOut,
} from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import { useProjectStore } from '@/stores/useProjectStore'
import { addToastListener, type ToastType } from '@/lib/toast'

// ─── Nav items ──────────────────────────────────────────────────

const NAV_ITEMS = [
  { label: 'Dashboard', route: '/', icon: LayoutDashboard },
  { label: 'Devis', route: '/devis', icon: FileText },
  { label: 'To-Do', route: '/todo', icon: CheckSquare },
  { label: 'Veille', route: '/talents', icon: Eye },
  { label: 'Finance', route: '/finance', icon: TrendingUp },
] as const

function isNavActive(route: string, pathname: string): boolean {
  if (route === '/') return pathname === '/'
  return pathname.startsWith(route)
}

// ─── Toast ──────────────────────────────────────────────────────

function Toast({ visible, message, type }: { visible: boolean; message: string; type: ToastType }) {
  const styles = type === 'error'
    ? 'border-red-200 bg-red-50 text-red-700'
    : 'border-emerald-200 bg-emerald-50 text-emerald-700'
  return (
    <div
      className={`fixed top-4 right-4 z-50 rounded-lg border px-4 py-2.5 text-[13px] font-medium shadow-lg transition-all duration-300 ${styles} ${
        visible ? 'translate-y-0 opacity-100' : '-translate-y-2 pointer-events-none opacity-0'
      }`}
    >
      {message}
    </div>
  )
}

// ─── Menu items ──────────────────────────────────────────────────

const MENU_ITEMS = [
  { label: 'Paramètres', route: '/devis/settings', icon: Settings },
  { label: 'Rate Cards', route: '/devis/ratecards', icon: CreditCard },
]

// ─── AppShell ────────────────────────────────────────────────────

export function AppShell() {
  const { signOut } = useAuth()
  const undo = useProjectStore((s) => s.undo)
  const location = useLocation()

  // ── Toast state ──
  const [toast, setToast] = useState<{ message: string; type: ToastType; visible: boolean }>({
    message: '',
    type: 'success',
    visible: false,
  })

  useEffect(() => addToastListener((message, type) => {
    setToast({ message, type, visible: true })
  }), [])

  useEffect(() => {
    if (!toast.visible) return
    const timer = setTimeout(() => setToast((t) => ({ ...t, visible: false })), 2500)
    return () => clearTimeout(timer)
  }, [toast.visible])

  // ── Keyboard shortcuts ──
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key === 's') {
        e.preventDefault()
        setToast({ message: 'Sauvegardé', type: 'success', visible: true })
      }
      if (mod && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      }
    },
    [undo],
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // ── ⋯ menu ──
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  // Close menu on navigation
  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  return (
    <div className="flex h-full flex-col">
      {/* ── Desktop header ─────────────────────────────────────── */}
      <header className="hidden shrink-0 items-center border-b border-neutral-200 bg-white px-6 md:flex" style={{ height: 56 }}>
        {/* Logo */}
        <NavLink to="/" className="text-[14px] font-semibold tracking-tight text-neutral-900">
          sadOS
        </NavLink>

        {/* Pill nav — centered */}
        <nav className="mx-auto flex items-center gap-0.5 rounded-xl bg-neutral-100 p-1">
          {NAV_ITEMS.map((item) => {
            const active = isNavActive(item.route, location.pathname)
            return (
              <NavLink
                key={item.route}
                to={item.route}
                className={`rounded-lg px-3.5 py-1.5 text-[12px] font-medium transition-all ${
                  active
                    ? 'bg-white font-semibold text-neutral-900 shadow-[0_1px_3px_rgba(0,0,0,0.08)]'
                    : 'text-neutral-500 hover:text-neutral-700'
                }`}
              >
                {item.label}
              </NavLink>
            )
          })}
        </nav>

        {/* ⋯ menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((p) => !p)}
            className="rounded-lg p-2 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
            aria-label="Menu"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full z-30 mt-1 min-w-[160px] rounded-lg border border-neutral-200 bg-white py-1 shadow-lg">
              {MENU_ITEMS.map((item) => (
                <NavLink
                  key={item.route}
                  to={item.route}
                  className="flex w-full items-center gap-2 px-4 py-2 text-[12px] text-neutral-600 transition-colors hover:bg-neutral-50"
                >
                  <item.icon className="h-3.5 w-3.5" />
                  {item.label}
                </NavLink>
              ))}
              <div className="my-1 border-t border-neutral-100" />
              <button
                onClick={() => { setMenuOpen(false); void signOut() }}
                className="flex w-full items-center gap-2 px-4 py-2 text-[12px] text-neutral-600 transition-colors hover:bg-neutral-50"
              >
                <LogOut className="h-3.5 w-3.5" />
                Déconnexion
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ── Main content ───────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
        <Outlet />
      </main>

      {/* ── Mobile bottom tab bar ──────────────────────────────── */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-neutral-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden" style={{ height: 56 }}>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const active = isNavActive(item.route, location.pathname)
          return (
            <NavLink
              key={item.route}
              to={item.route}
              className={`flex flex-col items-center gap-0.5 px-2 py-1.5 text-[10px] font-medium transition-colors ${
                active ? 'text-neutral-900' : 'text-neutral-400'
              }`}
            >
              <Icon className="h-5 w-5" strokeWidth={active ? 2.2 : 1.8} />
              <span>{item.label}</span>
            </NavLink>
          )
        })}
      </nav>

      <Toast visible={toast.visible} message={toast.message} type={toast.type} />
    </div>
  )
}
