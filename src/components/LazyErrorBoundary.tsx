import { Component, ReactNode, Suspense } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowsClockwise, Warning } from '@phosphor-icons/react'
import { motion } from 'framer-motion'

interface LazyErrorBoundaryProps {
  children: ReactNode
  fallbackMessage?: string
  componentName?: string
}

interface LazyErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class LazyErrorBoundary extends Component<LazyErrorBoundaryProps, LazyErrorBoundaryState> {
  constructor(props: LazyErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): LazyErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error(`[LazyErrorBoundary] ${this.props.componentName || 'Component'} failed to load:`, error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <Card className="p-6 sm:p-8 m-4">
          <div className="text-center max-w-md mx-auto">
            <Warning size={48} className="mx-auto mb-4 text-destructive" weight="fill" />
            <h3 className="text-lg font-semibold mb-2">
              {this.props.componentName || 'Component'} Failed to Load
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {this.props.fallbackMessage || 'Unable to load this component. Please check your connection and try again.'}
            </p>
            {this.state.error && (
              <details className="text-left mb-4 p-3 bg-muted rounded-lg">
                <summary className="text-xs font-medium cursor-pointer mb-2">Technical Details</summary>
                <pre className="text-xs overflow-auto whitespace-pre-wrap break-words">
                  {this.state.error.message}
                </pre>
              </details>
            )}
            <Button onClick={this.handleReset} className="gap-2">
              <ArrowsClockwise size={18} weight="bold" />
              Retry
            </Button>
          </div>
        </Card>
      )
    }

    return (
      <Suspense
        fallback={
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center p-8 gap-3"
          >
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full" 
            />
            <p className="text-sm text-muted-foreground">
              Loading {this.props.componentName || 'component'}...
            </p>
          </motion.div>
        }
      >
        {this.props.children}
      </Suspense>
    )
  }
}
