'use client'

import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  panelName: string
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class PanelErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="panel-error-boundary">
          <p>{this.props.panelName} failed to render.</p>
          <button className="auth-btn" onClick={this.handleRetry}>
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
