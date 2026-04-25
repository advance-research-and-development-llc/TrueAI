import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { ChartBar, TrendUp, Clock, CheckCircle } from '@phosphor-icons/react'
import type { ConversationAnalytics, ModelBenchmark } from '@/lib/types'

interface AnalyticsDashboardProps {
  analytics: ConversationAnalytics
  benchmarks: ModelBenchmark[]
}

export function AnalyticsDashboard({ analytics, benchmarks }: AnalyticsDashboardProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Analytics Dashboard</h2>
        <p className="text-muted-foreground">Usage statistics and performance metrics</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
              <ChartBar weight="fill" size={24} className="text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{analytics.totalMessages}</p>
              <p className="text-sm text-muted-foreground">Total Messages</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-accent/20 flex items-center justify-center">
              <CheckCircle weight="fill" size={24} className="text-accent" />
            </div>
            <div>
              <p className="text-2xl font-bold">{analytics.totalConversations}</p>
              <p className="text-sm text-muted-foreground">Conversations</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-green-500/20 flex items-center justify-center">
              <Clock weight="fill" size={24} className="text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{analytics.averageResponseTime}ms</p>
              <p className="text-sm text-muted-foreground">Avg Response</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <TrendUp weight="fill" size={24} className="text-purple-400" />
            </div>
            <div>
              <p className="text-lg font-bold">{analytics.mostUsedModel}</p>
              <p className="text-sm text-muted-foreground">Most Used</p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Model Performance Benchmarks</h3>
        <div className="space-y-4">
          {benchmarks.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              No benchmark data available yet
            </p>
          )}
          
          {benchmarks.map((benchmark) => (
            <div key={benchmark.modelId} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{benchmark.modelId}</span>
                  <Badge variant="secondary" className="text-xs">
                    {benchmark.totalRuns} runs
                  </Badge>
                </div>
                <span className="text-sm text-muted-foreground font-mono">
                  {benchmark.avgTokensPerSecond.toFixed(1)} tok/s
                </span>
              </div>
              
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Success Rate</span>
                  <span>{benchmark.successRate.toFixed(0)}%</span>
                </div>
                <Progress value={benchmark.successRate} className="h-2" />
              </div>
              
              <div className="text-xs text-muted-foreground">
                Avg Response: {benchmark.avgResponseTime}ms
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Top Topics</h3>
        <div className="flex flex-wrap gap-2">
          {analytics.topTopics.length === 0 && (
            <p className="text-muted-foreground">No topic data yet</p>
          )}
          {analytics.topTopics.map((topic) => (
            <Badge key={topic.topic} variant="outline">
              {topic.topic} ({topic.count})
            </Badge>
          ))}
        </div>
      </Card>
    </div>
  )
}
