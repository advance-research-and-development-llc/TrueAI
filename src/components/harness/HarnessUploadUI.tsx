import { useState } from 'react'
import { Card} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Upload, Link as LinkIcon, Package, CheckCircle, Trash } from '@phosphor-icons/react'
import type { CustomHarness } from '@/lib/types'
import { motion } from 'framer-motion'
import { toast } from 'sonner'

interface HarnessUploadUIProps {
  harnesses: CustomHarness[]
  onAdd: (harness: CustomHarness) => void
  onRemove: (harnessId: string) => void
  onToggle: (harnessId: string) => void
}

export function HarnessUploadUI({ harnesses, onAdd, onRemove, onToggle }: HarnessUploadUIProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [uploadMethod, setUploadMethod] = useState<'url' | 'manifest'>('url')
  const [harnessForm, setHarnessForm] = useState({
    name: '',
    description: '',
    manifestUrl: '',
    uploadUrl: '',
    tools: ''
  })

  const handleSubmit = () => {
    if (!harnessForm.name) {
      toast.error('Harness name is required')
      return
    }

    const newHarness: CustomHarness = {
      id: `harness-${Date.now()}`,
      name: harnessForm.name,
      description: harnessForm.description,
      manifestUrl: uploadMethod === 'manifest' ? harnessForm.manifestUrl : undefined,
      uploadUrl: uploadMethod === 'url' ? harnessForm.uploadUrl : undefined,
      tools: harnessForm.tools.split(',').map(t => t.trim()).filter(Boolean),
      createdAt: Date.now(),
      enabled: true
    }

    onAdd(newHarness)
    setDialogOpen(false)
    setHarnessForm({
      name: '',
      description: '',
      manifestUrl: '',
      uploadUrl: '',
      tools: ''
    })
    toast.success('Custom harness added')
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Custom Harnesses</h3>
          <p className="text-sm text-muted-foreground">Upload and manage custom AI tool harnesses</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Upload weight="bold" size={20} className="mr-2" />
          Add Harness
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {harnesses.length === 0 && (
          <Card className="col-span-full p-12">
            <p className="text-center text-muted-foreground">
              No custom harnesses installed
            </p>
          </Card>
        )}
        
        {harnesses.map((harness, index) => (
          <motion.div
            key={harness.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 }}
          >
            <Card className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1">
                  <div className="h-10 w-10 rounded-lg bg-accent/20 flex items-center justify-center shrink-0">
                    <Package weight="fill" size={24} className="text-accent" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">{harness.name}</h4>
                      {harness.enabled && (
                        <Badge variant="outline" className="text-xs bg-green-500/20 text-green-400 border-green-500/50">
                          <CheckCircle size={12} className="mr-1" weight="fill" />
                          Enabled
                        </Badge>
                      )}
                    </div>
                    
                    {harness.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {harness.description}
                      </p>
                    )}
                    
                    <div className="flex flex-wrap gap-1">
                      {harness.tools.map(tool => (
                        <Badge key={tool} variant="secondary" className="text-xs">
                          {tool}
                        </Badge>
                      ))}
                    </div>

                    {(harness.manifestUrl || harness.uploadUrl) && (
                      <p className="text-xs text-muted-foreground font-mono truncate">
                        {harness.manifestUrl || harness.uploadUrl}
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="flex flex-col gap-2">
                  <Button
                    size="sm"
                    variant={harness.enabled ? 'outline' : 'default'}
                    onClick={() => onToggle(harness.id)}
                  >
                    {harness.enabled ? 'Disable' : 'Enable'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onRemove(harness.id)}
                  >
                    <Trash weight="fill" size={16} />
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Custom Harness</DialogTitle>
            <DialogDescription>
              Upload a custom harness via URL or manifest file
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex gap-2">
              <Button
                variant={uploadMethod === 'url' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => setUploadMethod('url')}
              >
                <LinkIcon size={20} className="mr-2" />
                Direct URL
              </Button>
              <Button
                variant={uploadMethod === 'manifest' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => setUploadMethod('manifest')}
              >
                <Package size={20} className="mr-2" />
                Manifest URL
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="harness-name">Harness Name</Label>
              <Input
                id="harness-name"
                value={harnessForm.name}
                onChange={(e) => setHarnessForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="My Custom Harness"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="harness-description">Description</Label>
              <Textarea
                id="harness-description"
                value={harnessForm.description}
                onChange={(e) => setHarnessForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="What does this harness do?"
                rows={3}
              />
            </div>

            {uploadMethod === 'url' && (
              <div className="space-y-2">
                <Label htmlFor="harness-url">Upload URL</Label>
                <Input
                  id="harness-url"
                  type="url"
                  value={harnessForm.uploadUrl}
                  onChange={(e) => setHarnessForm(prev => ({ ...prev, uploadUrl: e.target.value }))}
                  placeholder="https://example.com/harness.zip"
                />
                <p className="text-xs text-muted-foreground">
                  Direct URL to the harness package file
                </p>
              </div>
            )}

            {uploadMethod === 'manifest' && (
              <div className="space-y-2">
                <Label htmlFor="harness-manifest">Manifest URL</Label>
                <Input
                  id="harness-manifest"
                  type="url"
                  value={harnessForm.manifestUrl}
                  onChange={(e) => setHarnessForm(prev => ({ ...prev, manifestUrl: e.target.value }))}
                  placeholder="https://example.com/harness-manifest.json"
                />
                <p className="text-xs text-muted-foreground">
                  URL to the harness manifest.json file (GitHub raw link, etc.)
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="harness-tools">Tools (comma-separated)</Label>
              <Input
                id="harness-tools"
                value={harnessForm.tools}
                onChange={(e) => setHarnessForm(prev => ({ ...prev, tools: e.target.value }))}
                placeholder="file_reader, code_executor, web_scraper"
              />
              <p className="text-xs text-muted-foreground">
                List of tools provided by this harness
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!harnessForm.name}>
              Add Harness
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
