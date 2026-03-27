import { Component } from 'react'
import type { ReactNode, ErrorInfo } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen flex-col items-center justify-center gap-4">
          <p className="text-[15px] font-medium text-neutral-800">Une erreur est survenue</p>
          <p className="text-[13px] text-neutral-500">L'application a rencontré un problème inattendu.</p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-md bg-neutral-900 px-4 py-2 text-[13px] text-white hover:bg-neutral-800"
          >
            Recharger
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
