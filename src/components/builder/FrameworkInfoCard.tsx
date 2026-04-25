import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle } from '@phosphor-icons/react'
import type { FrameworkConfig } from '@/lib/app-builder-types'

interface FrameworkInfoCardProps {
  framework: FrameworkConfig
}

export function FrameworkInfoCard({ framework }: FrameworkInfoCardProps) {
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3 mb-4">
        <div className="text-3xl">{framework.icon}</div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold">{framework.name}</h3>
          <p className="text-sm text-muted-foreground">{framework.description}</p>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <h4 className="text-sm font-medium mb-2">Key Features</h4>
          <div className="space-y-1.5">
            {framework.features.map((feature, index) => (
              <div key={index} className="flex items-start gap-2 text-sm">
                <CheckCircle weight="fill" size={16} className="text-accent mt-0.5 shrink-0" />
                <span className="text-muted-foreground">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-medium mb-2">File Structure</h4>
          <div className="space-y-1">
            {framework.fileStructure.map((file, index) => (
              <div key={index} className="flex items-center justify-between text-xs">
                <code className="font-mono text-muted-foreground">{file.path}</code>
                <Badge variant="outline" className="text-xs">
                  {file.language}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  )
}
