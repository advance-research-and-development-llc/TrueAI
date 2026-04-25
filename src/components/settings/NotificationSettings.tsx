import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import type { AppSettings } from '@/lib/types'

interface NotificationSettingsProps {
  settings: AppSettings
  onSettingsChange: (settings: AppSettings) => void
}

export function NotificationSettings({ settings, onSettingsChange }: NotificationSettingsProps) {
  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    onSettingsChange({ ...settings, [key]: value })
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">Notification Settings</h3>
        <p className="text-sm text-muted-foreground">
          Control how and when you receive notifications
        </p>
      </div>

      <Separator />

      <Card className="p-4 space-y-4">
        <div>
          <h4 className="font-medium mb-4">General Notifications</h4>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="enable-notifications">Enable notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Show system notifications
                </p>
              </div>
              <Switch
                id="enable-notifications"
                checked={settings.notificationsEnabled}
                onCheckedChange={(checked) => updateSetting('notificationsEnabled', checked)}
              />
            </div>

            {settings.notificationsEnabled && (
              <>
                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="notification-sound">Notification sound</Label>
                    <p className="text-sm text-muted-foreground">
                      Play sound on notifications
                    </p>
                  </div>
                  <Switch
                    id="notification-sound"
                    checked={settings.notificationSound}
                    onCheckedChange={(checked) => updateSetting('notificationSound', checked)}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </Card>

      <Card className="p-4 space-y-4">
        <div>
          <h4 className="font-medium mb-4">Event Notifications</h4>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="notify-agent-complete">Agent completion</Label>
                <p className="text-sm text-muted-foreground">
                  Notify when agent finishes execution
                </p>
              </div>
              <Switch
                id="notify-agent-complete"
                checked={settings.notifyAgentComplete}
                onCheckedChange={(checked) => updateSetting('notifyAgentComplete', checked)}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="notify-model-loaded">Model loaded</Label>
                <p className="text-sm text-muted-foreground">
                  Notify when model is ready
                </p>
              </div>
              <Switch
                id="notify-model-loaded"
                checked={settings.notifyModelLoaded}
                onCheckedChange={(checked) => updateSetting('notifyModelLoaded', checked)}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="notify-errors">Error notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Show notifications for errors
                </p>
              </div>
              <Switch
                id="notify-errors"
                checked={settings.notifyErrors}
                onCheckedChange={(checked) => updateSetting('notifyErrors', checked)}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="notify-updates">App updates</Label>
                <p className="text-sm text-muted-foreground">
                  Notify about new app versions
                </p>
              </div>
              <Switch
                id="notify-updates"
                checked={settings.notifyUpdates}
                onCheckedChange={(checked) => updateSetting('notifyUpdates', checked)}
              />
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-4 space-y-4">
        <div>
          <h4 className="font-medium mb-4">Toast Notifications</h4>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="show-toast">Show toast messages</Label>
                <p className="text-sm text-muted-foreground">
                  Display brief notification messages
                </p>
              </div>
              <Switch
                id="show-toast"
                checked={settings.showToast}
                onCheckedChange={(checked) => updateSetting('showToast', checked)}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="toast-success">Success messages</Label>
                <p className="text-sm text-muted-foreground">
                  Show success confirmations
                </p>
              </div>
              <Switch
                id="toast-success"
                checked={settings.toastSuccess}
                onCheckedChange={(checked) => updateSetting('toastSuccess', checked)}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="toast-info">Info messages</Label>
                <p className="text-sm text-muted-foreground">
                  Show informational messages
                </p>
              </div>
              <Switch
                id="toast-info"
                checked={settings.toastInfo}
                onCheckedChange={(checked) => updateSetting('toastInfo', checked)}
              />
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
