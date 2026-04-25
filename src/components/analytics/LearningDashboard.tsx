import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  Brain, 
  TrendUp, 
  TrendDown, 
  CheckCircle, 
  XCircle, 
  Target,
  CircleNotch,
  Sparkle,
  ArrowUp,
  ArrowDown,
  Lightbulb
} from '@phosphor-icons/react'
import { 
  learningAlgorithm,
  type UserFeedback,
  type LearningMetrics,
  type ThresholdAdjustment,
  type LearningStats
} from '@/lib/learning-algorithms'
import { thresholdManager, type ThresholdConfig } from '@/lib/confidence-thresholds'
import { toast } from 'sonner'
import { motion } from 'framer-motion'

interface LearningDashboardProps {
  thresholdConfig: ThresholdConfig
  onThresholdConfigChange: (config: ThresholdConfig) => void
}

export function LearningDashboard({ thresholdConfig, onThresholdConfigChange }: LearningDashboardProps) {
  const [metrics, setMetrics] = useState<LearningMetrics | null>(null)
  const [adjustments, setAdjustments] = useState<ThresholdAdjustment[]>([])
  const [learningStats, setLearningStats] = useState<LearningStats | null>(null)
  const [autoLearningEnabled, setAutoLearningEnabled] = useState(true)
  const [learningRate, setLearningRate] = useState(0.1)
  const [isLearning, setIsLearning] = useState(false)

  useEffect(() => {
    refreshMetrics()
  }, [])

  const refreshMetrics = () => {
    const currentMetrics = learningAlgorithm.calculateMetrics()
    const currentStats = learningAlgorithm.getLearningStats()
    setMetrics(currentMetrics)
    setLearningStats(currentStats)
  }

  const runLearningCycle = () => {
    setIsLearning(true)
    
    setTimeout(() => {
      const newAdjustments = learningAlgorithm.learnAndAdjustThresholds(thresholdConfig)
      
      if (newAdjustments.length > 0) {
        setAdjustments(newAdjustments)
        
        if (autoLearningEnabled) {
          applyAdjustments(newAdjustments)
        } else {
          toast.info(`${newAdjustments.length} threshold adjustments suggested`, {
            description: 'Review and apply manually'
          })
        }
      } else {
        toast.success('Thresholds are already optimal', {
          description: 'No adjustments needed at this time'
        })
      }
      
      refreshMetrics()
      setIsLearning(false)
    }, 1000)
  }

  const applyAdjustments = (adjustmentsToApply: ThresholdAdjustment[]) => {
    const newConfig = { ...thresholdConfig }
    
    adjustmentsToApply.forEach(adjustment => {
      newConfig.thresholds[adjustment.severity] = {
        ...newConfig.thresholds[adjustment.severity],
        minConfidence: adjustment.newThreshold
      }
    })

    onThresholdConfigChange(newConfig)
    toast.success(`Applied ${adjustmentsToApply.length} threshold adjustments`, {
      description: 'Thresholds have been optimized based on learning'
    })
    setAdjustments([])
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-destructive'
      case 'high': return 'text-orange-500'
      case 'medium': return 'text-yellow-500'
      case 'low': return 'text-blue-500'
      default: return 'text-muted-foreground'
    }
  }

  const getActionTypeColor = (actionType: string) => {
    switch (actionType) {
      case 'adjust_parameters': return 'bg-primary/10 text-primary'
      case 'change_model': return 'bg-accent/10 text-accent'
      case 'add_profile': return 'bg-blue-500/10 text-blue-500'
      case 'reduce_usage': return 'bg-orange-500/10 text-orange-500'
      default: return 'bg-muted text-muted-foreground'
    }
  }

  if (!metrics || !learningStats) {
    return (
      <Card className="p-8">
        <div className="text-center space-y-4">
          <Brain size={48} className="mx-auto text-muted-foreground" />
          <div>
            <h3 className="text-lg font-semibold">Learning Algorithm</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Collecting feedback to improve threshold accuracy...
            </p>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Brain size={24} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Adaptive Learning System</h2>
              <p className="text-sm text-muted-foreground">
                Automatically optimizes thresholds based on feedback
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Label htmlFor="auto-learning" className="text-sm">Auto-Apply</Label>
              <Switch 
                id="auto-learning"
                checked={autoLearningEnabled}
                onCheckedChange={setAutoLearningEnabled}
              />
            </div>
            <Button 
              onClick={runLearningCycle}
              disabled={isLearning || metrics.totalFeedback < 10}
              className="gap-2"
            >
              {isLearning ? (
                <>
                  <CircleNotch className="animate-spin" size={20} />
                  Learning...
                </>
              ) : (
                <>
                  <Sparkle size={20} />
                  Run Learning Cycle
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Total Feedback</span>
                <Target size={20} className="text-primary" />
              </div>
              <p className="text-2xl font-bold">{metrics.totalFeedback}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {metrics.totalFeedback >= 50 ? 'Excellent sample size' : 'Collecting data...'}
              </p>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Acceptance Rate</span>
                <CheckCircle size={20} className="text-green-500" />
              </div>
              <p className="text-2xl font-bold">{metrics.acceptanceRate.toFixed(1)}%</p>
              <Progress value={metrics.acceptanceRate} className="mt-2" />
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Success Rate</span>
                <TrendUp size={20} className="text-accent" />
              </div>
              <p className="text-2xl font-bold">{metrics.successRate.toFixed(1)}%</p>
              <Progress value={metrics.successRate} className="mt-2" />
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Precision</span>
                <CircleNotch size={20} className="text-blue-500" />
              </div>
              <p className="text-2xl font-bold">
                {(metrics.thresholdAccuracy.precision * 100).toFixed(1)}%
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                F1: {(metrics.thresholdAccuracy.f1Score * 100).toFixed(1)}%
              </p>
            </Card>
          </motion.div>
        </div>
      </Card>

      {adjustments.length > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          transition={{ duration: 0.3 }}
        >
          <Card className="p-6 border-accent">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Lightbulb size={24} className="text-accent" weight="fill" />
                <h3 className="text-lg font-semibold">Suggested Adjustments</h3>
              </div>
              <Button onClick={() => applyAdjustments(adjustments)}>
                Apply All {adjustments.length}
              </Button>
            </div>
            
            <div className="space-y-3">
              {adjustments.map((adjustment, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className={getSeverityColor(adjustment.severity)}>
                            {adjustment.severity}
                          </Badge>
                          <span className="font-mono text-sm">
                            {(adjustment.oldThreshold * 100).toFixed(0)}% → {(adjustment.newThreshold * 100).toFixed(0)}%
                          </span>
                          {adjustment.newThreshold > adjustment.oldThreshold ? (
                            <ArrowUp size={16} className="text-green-500" />
                          ) : (
                            <ArrowDown size={16} className="text-orange-500" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{adjustment.reason}</p>
                        <p className="text-xs text-accent mt-1">{adjustment.expectedImprovement}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground mb-1">Confidence</p>
                        <p className="text-lg font-semibold">{(adjustment.confidence * 100).toFixed(0)}%</p>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          </Card>
        </motion.div>
      )}

      <Tabs defaultValue="metrics" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="metrics">Performance Metrics</TabsTrigger>
          <TabsTrigger value="breakdown">Breakdown</TabsTrigger>
          <TabsTrigger value="settings">Learning Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="metrics" className="space-y-4">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Learning Performance</h3>
            
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Convergence Score</Label>
                  <span className="text-sm font-mono">
                    {(learningStats.convergenceScore * 100).toFixed(1)}%
                  </span>
                </div>
                <Progress value={learningStats.convergenceScore * 100} />
                <p className="text-xs text-muted-foreground mt-1">
                  How close the algorithm is to optimal thresholds
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Stability Score</Label>
                  <span className="text-sm font-mono">
                    {(learningStats.stabilityScore * 100).toFixed(1)}%
                  </span>
                </div>
                <Progress value={learningStats.stabilityScore * 100} />
                <p className="text-xs text-muted-foreground mt-1">
                  Consistency of threshold adjustments over time
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Performance Improvement</Label>
                  <span className={`text-sm font-mono flex items-center gap-1 ${
                    learningStats.performanceImprovement > 0 ? 'text-green-500' : 'text-orange-500'
                  }`}>
                    {learningStats.performanceImprovement > 0 ? (
                      <TrendUp size={16} />
                    ) : (
                      <TrendDown size={16} />
                    )}
                    {learningStats.performanceImprovement > 0 ? '+' : ''}
                    {learningStats.performanceImprovement.toFixed(1)}%
                  </span>
                </div>
                <Progress 
                  value={Math.min(100, Math.abs(learningStats.performanceImprovement))} 
                  className={learningStats.performanceImprovement < 0 ? 'bg-orange-500/20' : ''}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Success rate improvement from first half to second half of data
                </p>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-muted-foreground">Total Adjustments</Label>
                  <p className="text-2xl font-bold mt-1">{learningStats.totalAdjustments}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Current Learning Rate</Label>
                  <p className="text-2xl font-bold mt-1">{learningStats.learningRate.toFixed(3)}</p>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Classification Metrics</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <Card className="p-4 bg-green-500/10">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle size={20} className="text-green-500" />
                  <span className="text-sm font-medium">True Positives</span>
                </div>
                <p className="text-3xl font-bold">{metrics.thresholdAccuracy.truePositives}</p>
                <p className="text-xs text-muted-foreground mt-1">Correct auto-implementations</p>
              </Card>

              <Card className="p-4 bg-destructive/10">
                <div className="flex items-center gap-2 mb-2">
                  <XCircle size={20} className="text-destructive" />
                  <span className="text-sm font-medium">False Positives</span>
                </div>
                <p className="text-3xl font-bold">{metrics.thresholdAccuracy.falsePositives}</p>
                <p className="text-xs text-muted-foreground mt-1">Incorrect auto-implementations</p>
              </Card>

              <Card className="p-4 bg-muted">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle size={20} className="text-muted-foreground" />
                  <span className="text-sm font-medium">True Negatives</span>
                </div>
                <p className="text-3xl font-bold">{metrics.thresholdAccuracy.trueNegatives}</p>
                <p className="text-xs text-muted-foreground mt-1">Correctly rejected</p>
              </Card>

              <Card className="p-4 bg-orange-500/10">
                <div className="flex items-center gap-2 mb-2">
                  <XCircle size={20} className="text-orange-500" />
                  <span className="text-sm font-medium">False Negatives</span>
                </div>
                <p className="text-3xl font-bold">{metrics.thresholdAccuracy.falseNegatives}</p>
                <p className="text-xs text-muted-foreground mt-1">Missed opportunities</p>
              </Card>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="breakdown" className="space-y-4">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Performance by Severity</h3>
            
            <ScrollArea className="h-[400px]">
              <div className="space-y-4">
                {Object.entries(metrics.bySeverity).map(([severity, data]) => (
                  <Card key={severity} className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <Badge variant="outline" className={getSeverityColor(severity)}>
                        {severity}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {data.total} samples
                      </span>
                    </div>
                    
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Acceptance Rate</span>
                          <span className="font-mono">
                            {data.total > 0 ? ((data.accepted / data.total) * 100).toFixed(1) : 0}%
                          </span>
                        </div>
                        <Progress 
                          value={data.total > 0 ? (data.accepted / data.total) * 100 : 0} 
                        />
                      </div>
                      
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Success Rate</span>
                          <span className="font-mono">
                            {data.accepted > 0 ? ((data.successful / data.accepted) * 100).toFixed(1) : 0}%
                          </span>
                        </div>
                        <Progress 
                          value={data.accepted > 0 ? (data.successful / data.accepted) * 100 : 0}
                        />
                      </div>
                      
                      <div className="flex justify-between text-sm">
                        <span>Avg Confidence</span>
                        <span className="font-mono">{(data.avgConfidence * 100).toFixed(1)}%</span>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Performance by Action Type</h3>
            
            <ScrollArea className="h-[400px]">
              <div className="space-y-4">
                {Object.entries(metrics.byActionType).map(([actionType, data]) => (
                  <Card key={actionType} className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <Badge className={getActionTypeColor(actionType)}>
                        {actionType.replace('_', ' ')}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {data.total} samples
                      </span>
                    </div>
                    
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Acceptance Rate</span>
                          <span className="font-mono">
                            {data.total > 0 ? ((data.accepted / data.total) * 100).toFixed(1) : 0}%
                          </span>
                        </div>
                        <Progress 
                          value={data.total > 0 ? (data.accepted / data.total) * 100 : 0} 
                        />
                      </div>
                      
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Success Rate</span>
                          <span className="font-mono">
                            {data.accepted > 0 ? ((data.successful / data.accepted) * 100).toFixed(1) : 0}%
                          </span>
                        </div>
                        <Progress 
                          value={data.accepted > 0 ? (data.successful / data.accepted) * 100 : 0}
                        />
                      </div>
                      
                      <div className="flex justify-between text-sm">
                        <span>Avg Confidence</span>
                        <span className="font-mono">{(data.avgConfidence * 100).toFixed(1)}%</span>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Learning Algorithm Settings</h3>
            
            <div className="space-y-6">
              <div>
                <Label>Learning Rate: {learningRate.toFixed(3)}</Label>
                <Slider 
                  value={[learningRate]}
                  onValueChange={(values) => setLearningRate(values[0])}
                  min={0.01}
                  max={0.5}
                  step={0.01}
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Recommended: {learningStats.recommendedLearningRate.toFixed(3)}
                </p>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label>Auto-Apply Adjustments</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Automatically apply learned threshold adjustments
                  </p>
                </div>
                <Switch 
                  checked={autoLearningEnabled}
                  onCheckedChange={setAutoLearningEnabled}
                />
              </div>

              <Separator />

              <div className="space-y-3">
                <Label>Data Management</Label>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      const data = learningAlgorithm.exportFeedbackHistory()
                      const blob = new Blob([data], { type: 'application/json' })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = `learning-data-${Date.now()}.json`
                      a.click()
                      URL.revokeObjectURL(url)
                      toast.success('Learning data exported')
                    }}
                  >
                    Export Data
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => {
                      learningAlgorithm.reset()
                      refreshMetrics()
                      toast.success('Learning algorithm reset')
                    }}
                  >
                    Reset Algorithm
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
