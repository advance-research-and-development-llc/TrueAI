import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { Stack, Play, Trash, Clock, CheckCircle } from '@phosphor-icons/react'
import { emptyStateEnsemble } from '@/assets'
import type { EnsembleAgent, EnsembleRun } from '@/lib/types'

interface EnsembleManagerProps {
  ensembles: EnsembleAgent[]
  onCreateEnsemble: () => void
  onRunEnsemble: (ensembleId: string, prompt: string) => Promise<void>
  onDeleteEnsemble: (ensembleId: string) => void
}

export function EnsembleManager({ 
  ensembles, 
  onCreateEnsemble, 
  onRunEnsemble, 
  onDeleteEnsemble 
}: EnsembleManagerProps) {
  if (ensembles.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold mb-2">Multi-Model Ensemble</h2>
          <p className="text-muted-foreground">Run multiple AI models in parallel for consensus-based responses</p>
        </div>
        <Card className="p-12">
          <EmptyState
            illustration={emptyStateEnsemble}
            title="No ensembles configured"
            description="Create a multi-model ensemble to run multiple AI models simultaneously and combine their responses using different strategies like consensus, majority voting, or best-of-N"
            size="lg"
            action={
              <Button onClick={onCreateEnsemble}>
                <Stack weight="fill" size={20} className="mr-2" />
                Create Ensemble
              </Button>
            }
          />
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold mb-2">Multi-Model Ensemble</h2>
          <p className="text-muted-foreground">Run multiple AI models in parallel for consensus-based responses</p>
        </div>
        <Button onClick={onCreateEnsemble}>
          <Stack weight="fill" size={20} className="mr-2" />
          Create Ensemble
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {ensembles.map((ensemble) => (
          <Card key={ensemble.id} className="p-6">
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Stack weight="fill" size={20} className="text-primary" />
                    <h3 className="text-lg font-semibold">{ensemble.name}</h3>
                  </div>
                  <Badge variant="secondary" className="text-xs capitalize">
                    {ensemble.strategy}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDeleteEnsemble(ensemble.id)}
                >
                  <Trash size={16} />
                </Button>
              </div>

              <Separator />

              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-semibold uppercase">Models ({ensemble.models.length})</p>
                <div className="flex flex-wrap gap-2">
                  {ensemble.models.map((modelId) => (
                    <Badge key={modelId} variant="outline" className="text-xs">
                      {modelId}
                    </Badge>
                  ))}
                </div>
              </div>

              {ensemble.runs.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Last Run</span>
                      <span className="font-mono">
                        {new Date(ensemble.runs[0].timestamp).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <CheckCircle weight="fill" size={14} className="text-green-400" />
                      <span>{ensemble.runs.length} total runs</span>
                    </div>
                  </div>
                </>
              )}

              <Button 
                className="w-full" 
                variant="secondary"
                onClick={() => {
                  const prompt = window.prompt('Enter prompt for ensemble:')
                  if (prompt) onRunEnsemble(ensemble.id, prompt)
                }}
              >
                <Play weight="fill" size={16} className="mr-2" />
                Run Ensemble
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {ensembles.some(e => e.runs.length > 0) && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Recent Runs</h3>
          <div className="space-y-4">
            {ensembles.flatMap(e => 
              e.runs.slice(0, 3).map(run => (
                <div key={run.id} className="space-y-2 p-4 rounded-lg bg-muted/30">
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary">{ensembles.find(ens => ens.id === run.ensembleId)?.name}</Badge>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock size={12} />
                      <span>{new Date(run.timestamp).toLocaleString()}</span>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{run.prompt}</p>
                  <div className="flex items-center gap-2 text-xs">
                    <CheckCircle weight="fill" size={14} className="text-green-400" />
                    <span className="text-muted-foreground">
                      {run.responses.length} models responded
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      )}
    </div>
  )
}
