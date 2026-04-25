import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { ShieldCheck, Key } from '@phosphor-icons/react'
import type { AppSettings } from '@/lib/types'

interface PrivacySettingsProps {
  settings: AppSettings
  onSettingsChange: (settings: AppSettings) => void
}

export function PrivacySettings({ settings, onSettingsChange }: PrivacySettingsProps) {
  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    onSettingsChange({ ...settings, [key]: value })
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">Privacy & Security Settings</h3>
        <p className="text-sm text-muted-foreground">
          Control your data privacy and security preferences
        </p>
      </div>

      <Separator />

      <Card className="p-4 space-y-4">
        <div>
          <h4 className="font-medium mb-4 flex items-center gap-2">
            <ShieldCheck size={20} weight="fill" className="text-primary" />
            Privacy
          </h4>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="analytics">Usage analytics</Label>
                <p className="text-sm text-muted-foreground">
                  Help improve the app with anonymous usage data
                </p>
              </div>
              <Switch
                id="analytics"
                checked={settings.analyticsEnabled}
                onCheckedChange={(checked) => updateSetting('analyticsEnabled', checked)}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="crash-reports">Crash reports</Label>
                <p className="text-sm text-muted-foreground">
                  Send crash reports to help fix bugs
                </p>
              </div>
              <Switch
                id="crash-reports"
                checked={settings.crashReportsEnabled}
                onCheckedChange={(checked) => updateSetting('crashReportsEnabled', checked)}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="telemetry">Performance telemetry</Label>
                <p className="text-sm text-muted-foreground">
                  Share performance metrics
                </p>
              </div>
              <Switch
                id="telemetry"
                checked={settings.telemetryEnabled}
                onCheckedChange={(checked) => updateSetting('telemetryEnabled', checked)}
              />
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-4 space-y-4">
        <div>
          <h4 className="font-medium mb-4">Data Storage</h4>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="local-storage">Local data storage</Label>
                <p className="text-sm text-muted-foreground">
                  Store conversations and settings locally
                </p>
              </div>
              <Switch
                id="local-storage"
                checked={settings.localStorageEnabled}
                onCheckedChange={(checked) => updateSetting('localStorageEnabled', checked)}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="encrypt-data">Encrypt stored data</Label>
                <p className="text-sm text-muted-foreground">
                  Add encryption layer to stored data
                </p>
              </div>
              <Switch
                id="encrypt-data"
                checked={settings.encryptData}
                onCheckedChange={(checked) => updateSetting('encryptData', checked)}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="clear-on-exit">Clear data on exit</Label>
                <p className="text-sm text-muted-foreground">
                  Delete all data when closing app
                </p>
              </div>
              <Switch
                id="clear-on-exit"
                checked={settings.clearDataOnExit}
                onCheckedChange={(checked) => updateSetting('clearDataOnExit', checked)}
              />
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-4 space-y-4">
        <div>
          <h4 className="font-medium mb-4 flex items-center gap-2">
            <Key size={20} weight="fill" className="text-primary" />
            Security
          </h4>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="require-auth">Require authentication</Label>
                <p className="text-sm text-muted-foreground">
                  Require login to access the app
                </p>
              </div>
              <Switch
                id="require-auth"
                checked={settings.requireAuth}
                onCheckedChange={(checked) => updateSetting('requireAuth', checked)}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="auto-lock">Auto-lock on idle</Label>
                <p className="text-sm text-muted-foreground">
                  Lock app after period of inactivity
                </p>
              </div>
              <Switch
                id="auto-lock"
                checked={settings.autoLockEnabled}
                onCheckedChange={(checked) => updateSetting('autoLockEnabled', checked)}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="secure-mode">Secure mode</Label>
                <p className="text-sm text-muted-foreground">
                  Enable additional security measures
                </p>
              </div>
              <Switch
                id="secure-mode"
                checked={settings.secureMode}
                onCheckedChange={(checked) => updateSetting('secureMode', checked)}
              />
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-4 bg-muted/50 border-primary/20">
        <div className="flex items-start gap-3">
          <ShieldCheck size={24} weight="fill" className="text-primary mt-0.5 shrink-0" />
          <div className="space-y-2 flex-1">
            <h4 className="font-medium">Your Data is Private</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              All conversations and data are stored locally on your device. We never send your data to external servers unless you explicitly enable cloud sync features.
            </p>
            <Button variant="outline" size="sm" className="mt-2">
              Learn More About Privacy
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
