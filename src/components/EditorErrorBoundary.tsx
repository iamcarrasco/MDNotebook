'use client'

import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  onReset?: () => void
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class EditorErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
    this.props.onReset?.()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="editor-error-boundary">
          <div className="editor-error-content">
            <h3>Editor Error</h3>
            <p>The editor encountered an error and could not render this note.</p>
            <p className="editor-error-detail">{this.state.error?.message}</p>
            <button className="auth-btn" onClick={this.handleRetry}>
              Try Again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
