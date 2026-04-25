import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { AgentTool } from '@/lib/types'
import { getToolDescription, getToolCategory } from '@/lib/agent-tools'
import { Calculator, Clock, Brain, MagnifyingGlass, Code, FileText, BracketsCurly, CloudArrowDown, ChartLine, Image, ChatText, Article, Translate, CheckCircle } from '@phosphor-icons/react'

const toolIcons: Record<AgentTool, React.ReactNode> = {
  calculator: <Calculator size={20} />,
  datetime: <Clock size={20} />,
  memory: <Brain size={20} />,
  web_search: <MagnifyingGlass size={20} />,
  code_interpreter: <Code size={20} />,
  file_reader: <FileText size={20} />,
  json_parser: <BracketsCurly size={20} />,
  api_caller: <CloudArrowDown size={20} />,
  data_analyzer: <ChartLine size={20} />,
  image_generator: <Image size={20} />,
  sentiment_analyzer: <ChatText size={20} />,
  summarizer: <Article size={20} />,
  translator: <Translate size={20} />,
  validator: <CheckCircle size={20} />
}

const categoryColors: Record<string, string> = {
  computation: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  data: 'bg-green-500/10 text-green-500 border-green-500/20',
  communication: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  analysis: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  generation: 'bg-pink-500/10 text-pink-500 border-pink-500/20'
}

interface AgentToolSelectorProps {
  selectedTools: AgentTool[]
  onToggleTool: (tool: AgentTool) => void
}

export function AgentToolSelector({ selectedTools, onToggleTool }: AgentToolSelectorProps) {
  const allTools: AgentTool[] = [
    'calculator', 'datetime', 'memory', 'web_search',
    'code_interpreter', 'file_reader', 'json_parser', 'api_caller',
    'data_analyzer', 'image_generator', 'sentiment_analyzer',
    'summarizer', 'translator', 'validator'
  ]

  const toolsByCategory: Record<string, AgentTool[]> = {}
  allTools.forEach(tool => {
    const category = getToolCategory(tool)
    if (!toolsByCategory[category]) {
      toolsByCategory[category] = []
    }
    toolsByCategory[category].push(tool)
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold">Available Tools</Label>
        <Badge variant="secondary">{selectedTools.length} selected</Badge>
      </div>

      <ScrollArea className="h-[400px] pr-4">
        <div className="space-y-6">
          {Object.entries(toolsByCategory).map(([category, tools]) => (
            <div key={category}>
              <div className="flex items-center gap-2 mb-3">
                <Badge className={categoryColors[category]} variant="outline">
                  {category}
                </Badge>
                <Separator className="flex-1" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {tools.map(tool => (
                  <Card
                    key={tool}
                    className={`p-4 cursor-pointer transition-all hover:shadow-md ${
                      selectedTools.includes(tool)
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => onToggleTool(tool)}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={selectedTools.includes(tool)}
                        onCheckedChange={() => onToggleTool(tool)}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="text-primary">{toolIcons[tool]}</div>
                          <Label className="capitalize cursor-pointer font-medium">
                            {tool.replace(/_/g, ' ')}
                          </Label>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {getToolDescription(tool)}
                        </p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
