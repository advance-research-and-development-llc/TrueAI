import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useContextualUI } from '@/hooks/use-contextual-ui'
import { X, Lightbulb, Keyboard, TrendUp, Info } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'

export function ContextualSuggestionsPanel() {
  const { suggestions, dismissSuggestion } = useContextualUI()

  if (suggestions.length === 0) return null

  const getIcon = (type: string) => {
    switch (type) {
      case 'shortcut':
        return <Keyboard size={20} weight="fill" className="text-blue-500" />
      case 'optimization':
        return <TrendUp size={20} weight="fill" className="text-green-500" />
      case 'tip':
        return <Info size={20} weight="fill" className="text-yellow-500" />
      default:
        return <Lightbulb size={20} weight="fill" className="text-purple-500" />
    }
  }

  const topSuggestion = suggestions.sort((a, b) => b.priority - a.priority)[0]

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="fixed bottom-20 lg:bottom-6 right-4 z-40 max-w-sm"
      >
        <Card className="p-4 shadow-2xl border-2 border-accent/20 bg-card/95 backdrop-blur-xl">
          <div className="flex gap-3">
            <div className="shrink-0 mt-0.5">
              {getIcon(topSuggestion.type)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-1">
                <h4 className="font-semibold text-sm">{topSuggestion.title}</h4>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  onClick={() => dismissSuggestion(topSuggestion.id)}
                >
                  <X size={14} />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">{topSuggestion.description}</p>
              {topSuggestion.action && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3 h-7 text-xs"
                  onClick={topSuggestion.action}
                >
                  Take Action
                </Button>
              )}
            </div>
          </div>
          {suggestions.length > 1 && (
            <div className="mt-3 pt-3 border-t border-border">
              <p className="text-xs text-muted-foreground">
                +{suggestions.length - 1} more suggestion{suggestions.length > 2 ? 's' : ''}
              </p>
            </div>
          )}
        </Card>
      </motion.div>
    </AnimatePresence>
  )
}
