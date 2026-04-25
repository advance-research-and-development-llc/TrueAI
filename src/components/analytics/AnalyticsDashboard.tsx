import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { 
  ChartBar, 
  ChartLine, 
  Clock, 
  Users, 
  TrendUp, 
  ChatCircle,
  Robot,
  Lightning,
  Warning,
  CalendarDots,
  ArrowUp,
  ArrowDown,
  Download
} from '@phosphor-icons/react'
import { useAnalytics } from '@/lib/analytics'
import { MetricCard } from './MetricCard'
import { EventChart } from './EventChart'
import { CategoryBreakdown } from './CategoryBreakdown'
import { TimeSeriesChart } from './TimeSeriesChart'
import { TopItemsList } from './TopItemsList'
import { ModelUsageChart } from './ModelUsageChart'
import type { AnalyticsMetrics, AnalyticsFilter } from '@/lib/types'
import { toast } from 'sonner'

export function AnalyticsDashboard() {
  const { getMetrics, events, sessions, clearData } = useAnalytics()
  const [metrics, setMetrics] = useState<AnalyticsMetrics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | 'all'>('7d')
  const [filter, setFilter] = useState<AnalyticsFilter>({})

  useEffect(() => {
    loadMetrics()
  }, [timeRange])

  const loadMetrics = async () => {
    setIsLoading(true)
    try {
      const now = Date.now()
      const newFilter: AnalyticsFilter = {}

      if (timeRange === '7d') {
        newFilter.startDate = now - 7 * 24 * 60 * 60 * 1000
      } else if (timeRange === '30d') {
        newFilter.startDate = now - 30 * 24 * 60 * 60 * 1000
      }

      setFilter(newFilter)
      const data = await getMetrics(newFilter)
      setMetrics(data)
    } catch (error) {
      console.error('Failed to load metrics:', error)
      toast.error('Failed to load analytics')
    } finally {
      setIsLoading(false)
    }
  }

  const handleClearData = async () => {
    if (confirm('Are you sure you want to clear all analytics data? This cannot be undone.')) {
      await clearData()
      await loadMetrics()
      toast.success('Analytics data cleared')
    }
  }

  const handleExportData = () => {
    const dataStr = JSON.stringify({ events, sessions, metrics }, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `analytics-export-${Date.now()}.json`
    link.click()
    URL.revokeObjectURL(url)
    toast.success('Analytics data exported')
  }

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${Math.round(ms)}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
  }

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
  }

  if (isLoading || !metrics) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-2">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="text-muted-foreground">Loading analytics...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Analytics Dashboard</h2>
          <p className="text-muted-foreground">Track performance and usage metrics</p>
        </div>
        
        <div className="flex gap-2">
          <Select value={timeRange} onValueChange={(v) => setTimeRange(v as any)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
          
          <Button variant="outline" size="sm" onClick={handleExportData}>
            <Download size={16} className="mr-2" />
            Export
          </Button>
          
          <Button variant="outline" size="sm" onClick={handleClearData}>
            Clear Data
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Events"
          value={metrics.totalEvents}
          icon={<ChartBar weight="fill" size={24} />}
          trend={metrics.totalEvents > 0 ? 'up' : 'neutral'}
        />
        
        <MetricCard
          title="Active Sessions"
          value={metrics.totalSessions}
          icon={<Users weight="fill" size={24} />}
          trend={metrics.totalSessions > 0 ? 'up' : 'neutral'}
        />
        
        <MetricCard
          title="Avg Session Time"
          value={formatDuration(metrics.averageSessionDuration)}
          icon={<Clock weight="fill" size={24} />}
          trend="neutral"
        />
        
        <MetricCard
          title="Error Rate"
          value={`${metrics.errorRate.toFixed(1)}%`}
          icon={<Warning weight="fill" size={24} />}
          trend={metrics.errorRate > 5 ? 'down' : 'up'}
        />
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full max-w-2xl grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="chat">Chat</TabsTrigger>
          <TabsTrigger value="agents">Agents</TabsTrigger>
          <TabsTrigger value="models">Models</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <ChartLine weight="fill" size={20} />
                Events Over Time
              </h3>
              <TimeSeriesChart data={metrics.eventsByDay} />
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <ChartBar weight="fill" size={20} />
                Events by Type
              </h3>
              <CategoryBreakdown data={metrics.eventsByType} />
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Top Actions</h3>
              <TopItemsList
                items={metrics.topActions.map(a => ({
                  label: a.action,
                  value: a.count
                }))}
              />
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
              <ScrollArea className="h-64">
                <div className="space-y-2">
                  {events.slice(0, 20).map(event => (
                    <div key={event.id} className="flex items-center justify-between text-sm border-b border-border pb-2">
                      <div className="flex-1">
                        <p className="font-medium">{event.action}</p>
                        <p className="text-xs text-muted-foreground">{event.category}</p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {new Date(event.timestamp).toLocaleTimeString()}
                      </Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="chat" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MetricCard
              title="Total Messages"
              value={metrics.chatMetrics.totalMessages}
              icon={<ChatCircle weight="fill" size={24} />}
              trend="up"
            />
            
            <MetricCard
              title="Conversations"
              value={metrics.chatMetrics.totalConversations}
              icon={<ChatCircle weight="fill" size={24} />}
              trend="up"
            />
            
            <MetricCard
              title="Avg Response Time"
              value={formatDuration(metrics.chatMetrics.averageResponseTime)}
              icon={<Clock weight="fill" size={24} />}
              trend="neutral"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Most Used Models</h3>
              <ModelUsageChart data={metrics.chatMetrics.mostUsedModels} />
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Chat Statistics</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Avg Messages / Conv</span>
                  <span className="font-semibold">
                    {metrics.chatMetrics.averageMessagesPerConversation.toFixed(1)}
                  </span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Total Conversations</span>
                  <span className="font-semibold">{metrics.chatMetrics.totalConversations}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Total Messages</span>
                  <span className="font-semibold">{metrics.chatMetrics.totalMessages}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Response Time</span>
                  <span className="font-semibold">
                    {formatDuration(metrics.chatMetrics.averageResponseTime)}
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="agents" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <MetricCard
              title="Total Agents"
              value={metrics.agentMetrics.totalAgents}
              icon={<Robot weight="fill" size={24} />}
              trend="up"
            />
            
            <MetricCard
              title="Total Runs"
              value={metrics.agentMetrics.totalRuns}
              icon={<Lightning weight="fill" size={24} />}
              trend="up"
            />
            
            <MetricCard
              title="Success Rate"
              value={`${metrics.agentMetrics.successRate.toFixed(1)}%`}
              icon={<TrendUp weight="fill" size={24} />}
              trend={metrics.agentMetrics.successRate > 80 ? 'up' : 'down'}
            />
            
            <MetricCard
              title="Avg Execution Time"
              value={formatDuration(metrics.agentMetrics.averageExecutionTime)}
              icon={<Clock weight="fill" size={24} />}
              trend="neutral"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Most Used Tools</h3>
              <TopItemsList
                items={metrics.agentMetrics.mostUsedTools.map(t => ({
                  label: t.tool,
                  value: t.count
                }))}
              />
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Agent Performance</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Total Agents</span>
                  <span className="font-semibold">{metrics.agentMetrics.totalAgents}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Total Runs</span>
                  <span className="font-semibold">{metrics.agentMetrics.totalRuns}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Success Rate</span>
                  <div className="flex items-center gap-2">
                    {metrics.agentMetrics.successRate > 80 ? (
                      <ArrowUp size={16} className="text-green-500" />
                    ) : (
                      <ArrowDown size={16} className="text-red-500" />
                    )}
                    <span className="font-semibold">
                      {metrics.agentMetrics.successRate.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Avg Execution Time</span>
                  <span className="font-semibold">
                    {formatDuration(metrics.agentMetrics.averageExecutionTime)}
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="models" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MetricCard
              title="Total Models"
              value={metrics.modelMetrics.totalModels}
              icon={<Lightning weight="fill" size={24} />}
              trend="up"
            />
            
            <MetricCard
              title="Total Downloads"
              value={metrics.modelMetrics.totalDownloads}
              icon={<Download weight="fill" size={24} />}
              trend="up"
            />
            
            <MetricCard
              title="Storage Used"
              value={formatBytes(metrics.modelMetrics.storageUsed)}
              icon={<ChartBar weight="fill" size={24} />}
              trend="neutral"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Most Popular Models</h3>
              <TopItemsList
                items={metrics.modelMetrics.mostPopularModels.map(m => ({
                  label: m.model,
                  value: m.downloads
                }))}
              />
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Model Statistics</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Total Models</span>
                  <span className="font-semibold">{metrics.modelMetrics.totalModels}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Downloads</span>
                  <span className="font-semibold">{metrics.modelMetrics.totalDownloads}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Storage Used</span>
                  <span className="font-semibold">
                    {formatBytes(metrics.modelMetrics.storageUsed)}
                  </span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Most Popular</span>
                  <span className="font-semibold truncate max-w-[200px]">
                    {metrics.modelMetrics.mostPopularModels[0]?.model || 'N/A'}
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
