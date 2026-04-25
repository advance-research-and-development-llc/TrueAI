import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import type { AppSettings } from '@/lib/types'

interface AISettingsProps {
  settings: AppSettings
  onSettingsChange: (settings: AppSettings) => void
}

export function AISettings({ settings, onSettingsChange }: AISettingsProps) {
  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    onSettingsChange({ ...settings, [key]: value })
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">AI Behavior Settings</h3>
        <p className="text-sm text-muted-foreground">
          Configure how AI models respond and interact
        </p>
      </div>

      <Separator />

      <Card className="p-4 space-y-4">
        <div>
          <h4 className="font-medium mb-4">Response Behavior</h4>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="streaming">Streaming responses</Label>
                <p className="text-sm text-muted-foreground">
                  Show responses as they're generated
                </p>
              </div>
              <Switch
                id="streaming"
                checked={settings.streamingEnabled}
                onCheckedChange={(checked) => updateSetting('streamingEnabled', checked)}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="code-highlighting">Code syntax highlighting</Label>
                <p className="text-sm text-muted-foreground">
                  Highlight code blocks in responses
                </p>
              </div>
              <Switch
                id="code-highlighting"
                checked={settings.codeHighlighting}
                onCheckedChange={(checked) => updateSetting('codeHighlighting', checked)}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="markdown">Markdown formatting</Label>
                <p className="text-sm text-muted-foreground">
                  Render markdown in AI responses
                </p>
              </div>
              <Switch
                id="markdown"
                checked={settings.markdownEnabled}
                onCheckedChange={(checked) => updateSetting('markdownEnabled', checked)}
              />
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-4 space-y-4">
        <div>
          <h4 className="font-medium mb-4">Default Model Parameters</h4>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="default-temperature">Temperature</Label>
              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground w-20">Creative</span>
                <Slider
                  id="default-temperature"
                  min={0}
                  max={2}
                  step={0.1}
                  value={[settings.defaultTemperature]}
                  onValueChange={([value]) => updateSetting('defaultTemperature', value)}
                  className="flex-1"
                />
                <span className="text-sm text-muted-foreground w-20 text-right">Precise</span>
              </div>
              <p className="text-xs text-muted-foreground">Current: {settings.defaultTemperature}</p>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="default-max-tokens">Max tokens</Label>
              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground w-20">Short</span>
                <Slider
                  id="default-max-tokens"
                  min={100}
                  max={4000}
                  step={100}
                  value={[settings.defaultMaxTokens]}
                  onValueChange={([value]) => updateSetting('defaultMaxTokens', value)}
                  className="flex-1"
                />
                <span className="text-sm text-muted-foreground w-20 text-right">Long</span>
              </div>
              <p className="text-xs text-muted-foreground">Current: {settings.defaultMaxTokens} tokens</p>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-4 space-y-4">
        <div>
          <h4 className="font-medium mb-4">Agent Behavior</h4>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="auto-run-agents">Auto-run agents</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically execute agents after creation
                </p>
              </div>
              <Switch
                id="auto-run-agents"
                checked={settings.autoRunAgents}
                onCheckedChange={(checked) => updateSetting('autoRunAgents', checked)}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="show-agent-thinking">Show agent thinking</Label>
                <p className="text-sm text-muted-foreground">
                  Display detailed reasoning steps
                </p>
              </div>
              <Switch
                id="show-agent-thinking"
                checked={settings.showAgentThinking}
                onCheckedChange={(checked) => updateSetting('showAgentThinking', checked)}
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="agent-timeout">Agent execution timeout</Label>
              <Select
                value={String(settings.agentTimeout)}
                onValueChange={(value) => updateSetting('agentTimeout', parseInt(value))}
              >
                <SelectTrigger id="agent-timeout">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30000">30 seconds</SelectItem>
                  <SelectItem value="60000">1 minute</SelectItem>
                  <SelectItem value="120000">2 minutes</SelectItem>
                  <SelectItem value="300000">5 minutes</SelectItem>
                  <SelectItem value="600000">10 minutes</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Maximum time before agent execution is cancelled
              </p>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-4 space-y-4">
        <div>
          <h4 className="font-medium mb-4">Context & Memory</h4>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="conversation-context">Use conversation context</Label>
                <p className="text-sm text-muted-foreground">
                  Include previous messages in context
                </p>
              </div>
              <Switch
                id="conversation-context"
                checked={settings.useConversationContext}
                onCheckedChange={(checked) => updateSetting('useConversationContext', checked)}
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="context-window">Context window size</Label>
              <Select
                value={String(settings.contextWindowSize)}
                onValueChange={(value) => updateSetting('contextWindowSize', parseInt(value))}
              >
                <SelectTrigger id="context-window">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">Last 5 messages</SelectItem>
                  <SelectItem value="10">Last 10 messages</SelectItem>
                  <SelectItem value="20">Last 20 messages</SelectItem>
                  <SelectItem value="50">Last 50 messages</SelectItem>
                  <SelectItem value="100">Last 100 messages</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Number of previous messages to include
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
