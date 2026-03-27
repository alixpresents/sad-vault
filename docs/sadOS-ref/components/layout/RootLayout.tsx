import { useEffect } from 'react'
import { Outlet } from 'react-router'
import { Loader2 } from 'lucide-react'
import { useProjectStore } from '@/stores/useProjectStore'
import { useCompanyStore } from '@/stores/useCompanyStore'

export function RootLayout() {
  const init = useProjectStore((s) => s.init)
  const isReady = useProjectStore((s) => s.isReady)
  const initError = useProjectStore((s) => s.initError)
  const loadCompany = useCompanyStore((s) => s.load)

  useEffect(() => {
    void init()
    void loadCompany()
  }, [init, loadCompany])

  if (!isReady) {
    return (
      <div className="flex h-screen items-center justify-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />
        <p className="text-[13px] text-neutral-500">Chargement…</p>
      </div>
    )
  }

  if (initError) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <p className="text-[15px] font-medium text-neutral-800">Erreur de chargement</p>
        <p className="text-[13px] text-neutral-500">{initError}</p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-md bg-neutral-900 px-4 py-2 text-[13px] text-white hover:bg-neutral-800"
        >
          Réessayer
        </button>
      </div>
    )
  }

  return <Outlet />
}
