import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  FilePlus,
  MagnifyingGlass,
  Trash,
  File,
  HardDrives,
  ChartBar,
  Calendar,
  Tag,
  CheckCircle,
} from '@phosphor-icons/react'
import { EmptyState } from '@/components/ui/empty-state'
import { emptyStateModels } from '@/assets'
import type { GGUFModel } from '@/lib/types'

interface GGUFLibraryProps {
  models: GGUFModel[]
  /** Triggered when the user clicks "Import .gguf file". The host
   *  (App.tsx) is responsible for the picker → registry pipeline and
   *  for surfacing toasts. */
  onImport: () => void | Promise<void>
  onDeleteModel: (id: string) => void
  /** Triggered when the user marks a row as the active model. */
  onSetActive?: (id: string) => void | Promise<void>
  /** Best-effort free-space estimate in bytes; rendered when known. */
  freeBytes?: number | null
  /** Disable the import button while an import is in flight. */
  isImporting?: boolean
}

export function GGUFLibrary({
  models,
  onImport,
  onDeleteModel,
  onSetActive,
  freeBytes,
  isImporting,
}: GGUFLibraryProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'name' | 'size' | 'date'>('date')

  // Derive the live selected model from the props every render so a
  // model removed externally clears the details panel without an
  // effect-based round-trip (avoids the react-hooks/set-state-in-effect
  // warning).
  const selectedModel = selectedModelId
    ? models.find((m) => m.id === selectedModelId) ?? null
    : null

  const formatBytes = (bytes: number) => {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)))
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const filterModels = () => {
    const filtered = models.filter(model =>
      model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      model.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
      model.quantization.toLowerCase().includes(searchQuery.toLowerCase())
    )

    filtered.sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name)
      if (sortBy === 'size') return b.size - a.size
      if (sortBy === 'date') return b.downloadedAt - a.downloadedAt
      return 0
    })

    return filtered
  }

  const handleDeleteModel = (id: string) => {
    onDeleteModel(id)
    setSelectedModelId(null)
  }

  const handleSetActive = async (id: string) => {
    if (!onSetActive) return
    await onSetActive(id)
  }

  const filteredModels = filterModels()

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold">GGUF Model Library</h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Import a <code>.gguf</code> file from your device. The model is
            validated, hashed, and stored under app-private storage.
          </p>
          {typeof freeBytes === 'number' && freeBytes > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              Available storage: <span className="font-mono">{formatBytes(freeBytes)}</span>
            </p>
          )}
        </div>
        <Button
          onClick={() => { void onImport() }}
          disabled={isImporting}
          className="gap-2 w-full sm:w-auto h-10"
        >
          <FilePlus weight="bold" size={18} />
          {isImporting ? 'Importing…' : 'Import .gguf file'}
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
        <div className="relative flex-1">
          <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <Input
            placeholder="Search models..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10 text-sm"
          />
        </div>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
          <SelectTrigger className="w-full sm:w-[160px] h-10">
            <SelectValue placeholder="Sort by..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date">Recently Added</SelectItem>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="size">Size</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:gap-4">
        <div className="space-y-3 sm:space-y-0 sm:grid sm:grid-cols-1 lg:grid-cols-3 sm:gap-4">
          <div className="lg:col-span-2">
            {filteredModels.length === 0 && (
              <Card className="p-8 sm:p-12">
                <EmptyState
                  illustration={emptyStateModels}
                  title="No Models Found"
                  description={
                    searchQuery
                      ? 'Try a different search term'
                      : 'Import your first GGUF model to get started'
                  }
                  size="lg"
                  action={
                    !searchQuery ? (
                      <Button
                        onClick={() => { void onImport() }}
                        disabled={isImporting}
                        className="gap-2 mt-4 w-full sm:w-auto"
                      >
                        <FilePlus weight="bold" size={18} />
                        Import .gguf file
                      </Button>
                    ) : undefined
                  }
                />
              </Card>
            )}

            <div className="grid gap-3 sm:gap-4">
              {filteredModels.map(model => (
                <Card
                  key={model.id}
                  className={`p-3 sm:p-5 cursor-pointer transition-all hover:shadow-md ${selectedModel?.id === model.id ? 'ring-2 ring-primary' : ''}`}
                  onClick={() => setSelectedModelId(model.id)}
                >
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <File weight="duotone" size={24} className="text-primary sm:w-7 sm:h-7" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-base sm:text-lg truncate">{model.name}</h3>
                          <p className="text-xs sm:text-sm text-muted-foreground truncate mt-0.5">
                            {model.filename}
                          </p>
                        </div>
                        <Badge variant="secondary" className="flex-shrink-0 self-start text-xs">
                          {model.quantization}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap gap-2 sm:gap-4 mt-2 sm:mt-3 text-xs sm:text-sm text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <HardDrives size={14} />
                          <span>{formatBytes(model.size)}</span>
                        </div>
                        {model.architecture && (
                          <div className="flex items-center gap-1.5">
                            <ChartBar size={14} />
                            <span>{model.architecture}</span>
                          </div>
                        )}
                        {model.contextLength && (
                          <div className="flex items-center gap-1.5">
                            <Tag size={14} />
                            <span>{model.contextLength.toLocaleString()} ctx</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5">
                          <Calendar size={14} />
                          <span>{formatDate(model.downloadedAt)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          <div className="lg:col-span-1">
            <Card className="p-4 sm:p-6 sticky top-6">
              {selectedModel ? (
                <div className="space-y-3 sm:space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-base sm:text-lg">Model Details</h3>
                    <div className="flex items-center gap-1">
                      {onSetActive && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => { void handleSetActive(selectedModel.id) }}
                          className="gap-1 h-8"
                        >
                          <CheckCircle weight="bold" size={14} />
                          Set active
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label="Delete model"
                        onClick={() => handleDeleteModel(selectedModel.id)}
                        className="text-destructive hover:text-destructive h-8 w-8"
                      >
                        <Trash weight="bold" size={16} />
                      </Button>
                    </div>
                  </div>

                  <Separator />

                  <ScrollArea className="h-[300px] sm:h-auto sm:max-h-[600px]">
                    <div className="space-y-3 pr-2">
                      <div>
                        <Label className="text-muted-foreground text-xs">Name</Label>
                        <p className="font-medium mt-1 text-sm sm:text-base">{selectedModel.name}</p>
                      </div>

                      <div>
                        <Label className="text-muted-foreground text-xs">Filename</Label>
                        <p className="font-mono text-xs sm:text-sm mt-1 break-all">{selectedModel.filename}</p>
                      </div>

                      <div>
                        <Label className="text-muted-foreground text-xs">Path</Label>
                        <p className="font-mono text-xs sm:text-sm mt-1 break-all text-muted-foreground">{selectedModel.path}</p>
                      </div>

                      <Separator />

                      <div>
                        <Label className="text-muted-foreground text-xs">Size</Label>
                        <p className="font-medium mt-1 text-sm sm:text-base">{formatBytes(selectedModel.size)}</p>
                      </div>

                      <div>
                        <Label className="text-muted-foreground text-xs">Quantization</Label>
                        <p className="font-medium mt-1 text-sm sm:text-base">{selectedModel.quantization}</p>
                      </div>

                      {selectedModel.architecture && (
                        <div>
                          <Label className="text-muted-foreground text-xs">Architecture</Label>
                          <p className="font-medium mt-1 text-sm sm:text-base">{selectedModel.architecture}</p>
                        </div>
                      )}

                      {selectedModel.contextLength && (
                        <div>
                          <Label className="text-muted-foreground text-xs">Context Length</Label>
                          <p className="font-medium mt-1 text-sm sm:text-base">{selectedModel.contextLength.toLocaleString()} tokens</p>
                        </div>
                      )}

                      {selectedModel.parameterCount && (
                        <div>
                          <Label className="text-muted-foreground text-xs">Parameters</Label>
                          <p className="font-medium mt-1 text-sm sm:text-base">
                            {(selectedModel.parameterCount / 1000000000).toFixed(1)}B
                          </p>
                        </div>
                      )}

                      <Separator />

                      <div>
                        <Label className="text-muted-foreground text-xs">Imported</Label>
                        <p className="font-medium mt-1 text-sm sm:text-base">{formatDate(selectedModel.downloadedAt)}</p>
                      </div>

                      {selectedModel.lastUsed && (
                        <div>
                          <Label className="text-muted-foreground text-xs">Last Used</Label>
                          <p className="font-medium mt-1 text-sm sm:text-base">{formatDate(selectedModel.lastUsed)}</p>
                        </div>
                      )}

                      {selectedModel.metadata.tensorCount && (
                        <>
                          <Separator />
                          <div>
                            <Label className="text-muted-foreground text-xs">Technical Details</Label>
                            <div className="mt-2 space-y-2 text-xs sm:text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Tensors:</span>
                                <span className="font-mono">{selectedModel.metadata.tensorCount}</span>
                              </div>
                              {selectedModel.metadata.layerCount && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Layers:</span>
                                  <span className="font-mono">{selectedModel.metadata.layerCount}</span>
                                </div>
                              )}
                              {selectedModel.metadata.headCount && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Heads:</span>
                                  <span className="font-mono">{selectedModel.metadata.headCount}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              ) : (
                <div className="text-center py-8 sm:py-12 space-y-3 px-4">
                  <EmptyState
                    illustration={emptyStateModels}
                    title="No Model Selected"
                    description="Select a model to view details"
                    size="sm"
                  />
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

export default GGUFLibrary
