import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Warning } from '@phosphor-icons/react'
import type { AppSettings } from '@/lib/types'

interface AdvancedSettingsProps {
  settings: AppSettings
  onSettingsChange: (settings: AppSettings) => void
}

export function AdvancedSettings({ settings, onSettingsChange }: AdvancedSettingsProps) {
  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    onSettingsChange({ ...settings, [key]: value })
  }

  const handleResetSettings = () => {
    if (confirm('Reset all settings to default? This will not delete your data.')) {
      const defaultSettings: AppSettings = {
        autoSave: true,
        confirmDelete: true,
        keyboardShortcuts: true,
        language: 'en',
        timezone: 'UTC',
        dateFormat: 'MM/DD/YYYY',
        maxHistory: 50,
        preloadModels: true,
        theme: 'dark',
        fontSize: 15,
        density: 'comfortable',
        showTimestamps: true,
        showAvatars: true,
        compactSidebar: false,
        enableAnimations: true,
        animationSpeed: 1,
        reduceMotion: false,
        streamingEnabled: true,
        codeHighlighting: true,
        markdownEnabled: true,
        defaultTemperature: 0.7,
        defaultMaxTokens: 2000,
        autoRunAgents: false,
        showAgentThinking: true,
        agentTimeout: 120000,
        useConversationContext: true,
        contextWindowSize: 20,
        notificationsEnabled: true,
        notificationSound: true,
        notifyAgentComplete: true,
        notifyModelLoaded: false,
        notifyErrors: true,
        notifyUpdates: true,
        showToast: true,
        toastSuccess: true,
        toastInfo: true,
        analyticsEnabled: true,
        crashReportsEnabled: true,
        telemetryEnabled: true,
        localStorageEnabled: true,
        encryptData: false,
        clearDataOnExit: false,
        requireAuth: false,
        autoLockEnabled: false,
        secureMode: false,
        debugMode: false,
        devTools: false,
        experimentalFeatures: false,
        apiEndpoint: 'default',
        requestTimeout: 30000,
        retryAttempts: 3,
        cacheEnabled: true,
        offlineMode: false,
      }
      
      onSettingsChange(defaultSettings)
      toast.success('Settings reset to defaults')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">Advanced Settings</h3>
        <p className="text-sm text-muted-foreground">
          Configure advanced features and developer options
        </p>
      </div>

      <Separator />

      <Card className="p-4 space-y-4">
        <div>
          <h4 className="font-medium mb-4">Developer Options</h4>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="debug-mode">Debug mode</Label>
                <p className="text-sm text-muted-foreground">
                  Show detailed logs and debugging info
                </p>
              </div>
              <Switch
                id="debug-mode"
                checked={settings.debugMode}
                onCheckedChange={(checked) => updateSetting('debugMode', checked)}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="dev-tools">Developer tools</Label>
                <p className="text-sm text-muted-foreground">
                  Enable advanced developer features
                </p>
              </div>
              <Switch
                id="dev-tools"
                checked={settings.devTools}
                onCheckedChange={(checked) => updateSetting('devTools', checked)}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="experimental">Experimental features</Label>
                <p className="text-sm text-muted-foreground">
                  Try new features before official release
                </p>
              </div>
              <Switch
                id="experimental"
                checked={settings.experimentalFeatures}
                onCheckedChange={(checked) => updateSetting('experimentalFeatures', checked)}
              />
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-4 space-y-4">
        <div>
          <h4 className="font-medium mb-4">Network & Performance</h4>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="api-endpoint">API Endpoint</Label>
              <Select
                value={settings.apiEndpoint}
                onValueChange={(value) => updateSetting('apiEndpoint', value)}
              >
                <SelectTrigger id="api-endpoint">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                  <SelectItem value="local">Local Development</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="request-timeout">Request timeout (ms)</Label>
              <Input
                id="request-timeout"
                type="number"
                min="5000"
                max="120000"
                step="1000"
                value={settings.requestTimeout}
                onChange={(e) => updateSetting('requestTimeout', parseInt(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                Maximum time to wait for API responses
              </p>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="retry-attempts">Retry attempts</Label>
              <Input
                id="retry-attempts"
                type="number"
                min="0"
                max="5"
                value={settings.retryAttempts}
                onChange={(e) => updateSetting('retryAttempts', parseInt(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                Number of times to retry failed requests
              </p>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="cache-enabled">Enable caching</Label>
                <p className="text-sm text-muted-foreground">
                  Cache responses for better performance
                </p>
              </div>
              <Switch
                id="cache-enabled"
                checked={settings.cacheEnabled}
                onCheckedChange={(checked) => updateSetting('cacheEnabled', checked)}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="offline-mode">Offline mode</Label>
                <p className="text-sm text-muted-foreground">
                  Work without internet connection
                </p>
              </div>
              <Switch
                id="offline-mode"
                checked={settings.offlineMode}
                onCheckedChange={(checked) => updateSetting('offlineMode', checked)}
              />
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <div>
          <h4 className="font-medium mb-4">System</h4>
          
          <div className="space-y-3">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => {
                localStorage.clear()
                toast.success('Browser cache cleared')
              }}
            >
              Clear Browser Cache
            </Button>
            
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={handleResetSettings}
            >
              Reset to Default Settings
            </Button>
            
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => {
                window.location.reload()
              }}
            >
              Reload Application
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-4 bg-amber-500/10 border-amber-500/20">
        <div className="flex items-start gap-3">
          <Warning size={24} weight="fill" className="text-amber-500 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <h4 className="font-medium text-amber-600 dark:text-amber-400">Caution</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              These settings are for advanced users only. Changing them may affect application stability or performance. Make sure you understand the implications before modifying these options.
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
