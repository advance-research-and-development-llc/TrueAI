import { Agent } from '@/lib/types'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Play, Trash, Robot } from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface AgentCardProps {
  agent: Agent
  onRun: (agentId: string) => void
  onDelete: (agentId: string) => void
  onView: (agentId: string) => void
}

const getStatusColor = (status: Agent['status']) => {
  switch (status) {
    case 'running':
      return 'bg-accent/20 text-accent border-accent/50 animate-pulse-glow'
    case 'completed':
      return 'bg-green-500/20 text-green-400 border-green-500/50'
    case 'error':
      return 'bg-destructive/20 text-destructive border-destructive/50'
    default:
      return 'bg-muted text-muted-foreground border-border'
  }
}

export function AgentCard({ agent, onRun, onDelete, onView }: AgentCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      whileHover={{ y: -4 }}
    >
      <Card 
        className="cursor-pointer hover:border-accent/50 transition-all duration-200"
        onClick={() => onView(agent.id)}
      >
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1">
              <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                <Robot weight="fill" size={24} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <CardTitle className="text-lg truncate">{agent.name}</CardTitle>
                <CardDescription className="mt-1 line-clamp-2">
                  {agent.goal}
                </CardDescription>
              </div>
            </div>
            
            <Badge variant="outline" className={cn('shrink-0', getStatusColor(agent.status))}>
              {agent.status}
            </Badge>
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1">
              {agent.tools.map((tool) => (
                <Badge key={tool} variant="secondary" className="text-xs">
                  {tool}
                </Badge>
              ))}
            </div>
            
            <div className="flex gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
              <Button
                size="sm"
                variant="default"
                onClick={() => onRun(agent.id)}
                disabled={agent.status === 'running'}
              >
                <Play weight="fill" size={16} className="mr-1" />
                Run
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onDelete(agent.id)}
              >
                <Trash weight="fill" size={16} />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
