import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import type { AppSettings } from '@/lib/types'

interface GeneralSettingsProps {
  settings: AppSettings
  onSettingsChange: (settings: AppSettings) => void
}

export function GeneralSettings({ settings, onSettingsChange }: GeneralSettingsProps) {
  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    onSettingsChange({ ...settings, [key]: value })
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">General Settings</h3>
        <p className="text-sm text-muted-foreground">
          Configure basic application behavior and preferences
        </p>
      </div>

      <Separator />

      <Card className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="auto-save">Auto-save conversations</Label>
            <p className="text-sm text-muted-foreground">
              Automatically save conversations as you type
            </p>
          </div>
          <Switch
            id="auto-save"
            checked={settings.autoSave}
            onCheckedChange={(checked) => updateSetting('autoSave', checked)}
          />
        </div>

        <Separator />

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="confirm-delete">Confirm before deleting</Label>
            <p className="text-sm text-muted-foreground">
              Show confirmation dialog when deleting items
            </p>
          </div>
          <Switch
            id="confirm-delete"
            checked={settings.confirmDelete}
            onCheckedChange={(checked) => updateSetting('confirmDelete', checked)}
          />
        </div>

        <Separator />

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="keyboard-shortcuts">Keyboard shortcuts</Label>
            <p className="text-sm text-muted-foreground">
              Enable keyboard shortcuts for navigation
            </p>
          </div>
          <Switch
            id="keyboard-shortcuts"
            checked={settings.keyboardShortcuts}
            onCheckedChange={(checked) => updateSetting('keyboardShortcuts', checked)}
          />
        </div>
      </Card>

      <Card className="p-4 space-y-4">
        <div>
          <h4 className="font-medium mb-4">Language & Region</h4>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="language">Language</Label>
              <Select
                value={settings.language}
                onValueChange={(value: AppSettings['language']) => updateSetting('language', value)}
              >
                <SelectTrigger id="language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="es">Español</SelectItem>
                  <SelectItem value="fr">Français</SelectItem>
                  <SelectItem value="de">Deutsch</SelectItem>
                  <SelectItem value="ja">日本語</SelectItem>
                  <SelectItem value="zh">中文</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Select
                value={settings.timezone}
                onValueChange={(value) => updateSetting('timezone', value)}
              >
                <SelectTrigger id="timezone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UTC">UTC</SelectItem>
                  <SelectItem value="America/New_York">Eastern Time</SelectItem>
                  <SelectItem value="America/Chicago">Central Time</SelectItem>
                  <SelectItem value="America/Denver">Mountain Time</SelectItem>
                  <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                  <SelectItem value="Europe/London">London</SelectItem>
                  <SelectItem value="Europe/Paris">Paris</SelectItem>
                  <SelectItem value="Asia/Tokyo">Tokyo</SelectItem>
                  <SelectItem value="Asia/Shanghai">Shanghai</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="date-format">Date format</Label>
              <Select
                value={settings.dateFormat}
                onValueChange={(value: AppSettings['dateFormat']) => updateSetting('dateFormat', value)}
              >
                <SelectTrigger id="date-format">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                  <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                  <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                  <SelectItem value="relative">Relative (e.g., "2 days ago")</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-4 space-y-4">
        <div>
          <h4 className="font-medium mb-4">Performance</h4>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="max-history">Max conversation history</Label>
              <p className="text-sm text-muted-foreground mb-2">
                Number of messages to keep in context
              </p>
              <Input
                id="max-history"
                type="number"
                min="10"
                max="200"
                value={settings.maxHistory}
                onChange={(e) => updateSetting('maxHistory', parseInt(e.target.value))}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="preload-models">Preload models</Label>
                <p className="text-sm text-muted-foreground">
                  Load models in background for faster responses
                </p>
              </div>
              <Switch
                id="preload-models"
                checked={settings.preloadModels}
                onCheckedChange={(checked) => updateSetting('preloadModels', checked)}
              />
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
