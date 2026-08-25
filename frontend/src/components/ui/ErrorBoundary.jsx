import React from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import { Button } from './Button'

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('Unhandled React Error Boundary Catch:', error, errorInfo)
    this.setState({ errorInfo })
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[400px] flex items-center justify-center p-6 text-center">
          <div className="card max-w-lg p-8 space-y-4 border border-red-500/30 bg-[#16162a]">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto text-red-400">
              <AlertTriangle size={24} />
            </div>
            
            <div>
              <h2 className="text-lg font-semibold text-slate-100 mb-1">
                {this.props.title || 'Something went wrong rendering this page'}
              </h2>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                {this.state.error?.message || 'An unexpected UI error occurred.'}
              </p>
            </div>

            {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
              <pre className="text-[10px] text-left text-slate-500 bg-[#0f0f1a] p-3 rounded-lg overflow-x-auto max-h-32">
                {this.state.errorInfo.componentStack}
              </pre>
            )}

            <div className="flex items-center justify-center gap-3 pt-2">
              <Button variant="secondary" onClick={this.handleReset} size="sm">
                <RefreshCw size={14} /> Try Again
              </Button>
              <Button variant="primary" onClick={() => window.location.href = '/dashboard'} size="sm">
                <Home size={14} /> Back to Dashboard
              </Button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
