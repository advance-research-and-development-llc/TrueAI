import { AgentStep } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Brain, Calculator, Clock, Database, CheckCircle} from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface AgentStepViewProps {
  step: AgentStep
  index: number
}

const getStepIcon = (type: AgentStep['type']) => {
  switch (type) {
    case 'planning':
      return <Brain weight="fill" size={20} />
    case 'tool_call':
      return <Calculator weight="fill" size={20} />
    case 'observation':
      return <Database weight="fill" size={20} />
    case 'decision':
      return <CheckCircle weight="fill" size={20} />
    default:
      return <Clock weight="fill" size={20} />
  }
}

const getStepColor = (type: AgentStep['type']) => {
  switch (type) {
    case 'planning':
      return 'bg-primary/20 text-primary border-primary/30'
    case 'tool_call':
      return 'bg-accent/20 text-accent-foreground border-accent/30'
    case 'observation':
      return 'bg-secondary/20 text-secondary-foreground border-secondary/30'
    case 'decision':
      return 'bg-green-500/20 text-green-400 border-green-500/30'
    default:
      return 'bg-muted text-muted-foreground border-border'
  }
}

export function AgentStepView({ step, index }: AgentStepViewProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: index * 0.1 }}
      className="relative pl-8"
    >
      <div className="absolute left-0 top-2 w-6 h-6 rounded-full flex items-center justify-center border-2 bg-background z-10"
        style={{ borderColor: 'var(--accent)' }}
      >
        <span className="text-xs font-mono font-bold text-accent">{index + 1}</span>
      </div>
      
      {index > 0 && (
        <div className="absolute left-3 top-0 w-0.5 h-2 bg-accent/30" />
      )}
      
      <Card className={cn(
        'p-4 border-2 mb-4',
        getStepColor(step.type)
      )}>
        <div className="flex items-start gap-3">
          <div className="mt-0.5">
            {getStepIcon(step.type)}
          </div>
          
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs font-mono">
                {step.type.replace('_', ' ')}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {new Date(step.timestamp).toLocaleTimeString()}
              </span>
            </div>
            
            <p className="text-sm leading-relaxed">{step.content}</p>
            
            {step.toolName && (
              <div className="mt-3 space-y-2">
                <div className="text-xs font-mono text-muted-foreground">
                  Tool: <span className="text-accent">{step.toolName}</span>
                </div>
                {step.toolInput && (
                  <div className="bg-background/50 p-2 rounded text-xs font-mono">
                    <span className="text-muted-foreground">Input:</span> {step.toolInput}
                  </div>
                )}
                {step.toolOutput && (
                  <div className="bg-background/50 p-2 rounded text-xs font-mono">
                    <span className="text-muted-foreground">Output:</span> {step.toolOutput}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  )
}

export default AgentStepView
