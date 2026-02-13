'use client'

import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="app-error-boundary">
          <div className="app-error-content">
            <h2>Something went wrong</h2>
            <p>MDNotebook encountered an unexpected error. Your data has been saved to your vault.</p>
            <p className="editor-error-detail">{this.state.error?.message}</p>
            <button className="auth-btn" onClick={this.handleReload}>
              Reload App
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
