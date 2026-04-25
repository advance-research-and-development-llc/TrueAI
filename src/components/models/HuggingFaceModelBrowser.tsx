import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Download, MagnifyingGlass, TrendUp } from '@phosphor-icons/react'
import type { HuggingFaceModel } from '@/lib/types'
import { motion } from 'framer-motion'

interface HuggingFaceModelBrowserProps {
  onDownload: (model: HuggingFaceModel) => void
}

const MOCK_MODELS: HuggingFaceModel[] = [
  {
    id: 'TheBloke/Llama-2-7B-GGUF',
    name: 'Llama-2-7B',
    author: 'TheBloke',
    downloads: 125000,
    likes: 450,
    size: 3.8,
    quantization: 'Q4_K_M',
    contextLength: 4096,
    tags: ['llama', 'text-generation', 'gguf'],
    description: 'Llama 2 7B model quantized to GGUF format',
    downloadUrl: 'https://huggingface.co/TheBloke/Llama-2-7B-GGUF/resolve/main/llama-2-7b.Q4_K_M.gguf'
  },
  {
    id: 'TheBloke/Mistral-7B-Instruct-v0.2-GGUF',
    name: 'Mistral-7B-Instruct',
    author: 'TheBloke',
    downloads: 89000,
    likes: 380,
    size: 4.1,
    quantization: 'Q5_K_M',
    contextLength: 8192,
    tags: ['mistral', 'instruct', 'gguf'],
    description: 'Mistral 7B Instruct v0.2 quantized to GGUF',
    downloadUrl: 'https://huggingface.co/TheBloke/Mistral-7B-Instruct-v0.2-GGUF/resolve/main/mistral-7b-instruct-v0.2.Q5_K_M.gguf'
  },
  {
    id: 'TheBloke/Phi-3-mini-4k-instruct-GGUF',
    name: 'Phi-3-Mini-4K',
    author: 'TheBloke',
    downloads: 67000,
    likes: 290,
    size: 2.3,
    quantization: 'Q4_K_M',
    contextLength: 4096,
    tags: ['phi', 'instruct', 'gguf'],
    description: 'Microsoft Phi-3 Mini 4K instruct model',
    downloadUrl: 'https://huggingface.co/TheBloke/Phi-3-mini-4k-instruct-GGUF/resolve/main/phi-3-mini-4k-instruct.Q4_K_M.gguf'
  }
]

export function HuggingFaceModelBrowser({ onDownload }: HuggingFaceModelBrowserProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [models] = useState<HuggingFaceModel[]>(MOCK_MODELS)

  const filteredModels = models.filter(model =>
    model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    model.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
    model.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  return (
    <Card className="p-6">
      <CardHeader className="px-0 pt-0">
        <CardTitle>HuggingFace Model Browser</CardTitle>
        <CardDescription>Search and download GGUF models from HuggingFace</CardDescription>
      </CardHeader>

      <div className="space-y-4">
        <div className="relative">
          <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
          <Input
            id="hf-search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search models by name, author, or tag..."
            className="pl-10"
          />
        </div>

        <ScrollArea className="h-[500px] pr-4">
          <div className="space-y-3">
            {filteredModels.length === 0 && (
              <p className="text-center text-muted-foreground py-12">
                No models found
              </p>
            )}
            
            {filteredModels.map((model, index) => (
              <motion.div
                key={model.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="p-4 hover:border-accent/50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-start gap-2">
                        <h4 className="font-semibold text-base">{model.name}</h4>
                        <Badge variant="secondary" className="text-xs">
                          {model.quantization}
                        </Badge>
                      </div>
                      
                      <p className="text-sm text-muted-foreground">
                        by {model.author}
                      </p>
                      
                      {model.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {model.description}
                        </p>
                      )}
                      
                      <div className="flex flex-wrap gap-1">
                        {model.tags.slice(0, 3).map(tag => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                      
                      <div className="flex items-center gap-4 text-xs text-muted-foreground font-mono">
                        <span>Size: {model.size.toFixed(1)}GB</span>
                        <span>Context: {model.contextLength}</span>
                        <span className="flex items-center gap-1">
                          <TrendUp size={14} />
                          {(model.downloads / 1000).toFixed(0)}k downloads
                        </span>
                      </div>
                    </div>
                    
                    <Button onClick={() => onDownload(model)} size="sm">
                      <Download weight="bold" size={16} className="mr-2" />
                      Download
                    </Button>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </ScrollArea>
      </div>
    </Card>
  )
}
