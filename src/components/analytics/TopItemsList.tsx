import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

interface TopItemsListProps {
  items: { label: string; value: number }[]
}

export function TopItemsList({ items }: TopItemsListProps) {
  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground">
        No data available
      </div>
    )
  }

  const maxValue = Math.max(...items.map(i => i.value), 1)

  return (
    <div className="space-y-3">
      {items.map((item, index) => {
        const percentage = (item.value / maxValue) * 100
        return (
          <div key={index} className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium truncate max-w-[200px]">{item.label}</span>
              <Badge variant="secondary">{item.value}</Badge>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${percentage}%` }}
              />
            </div>
            {index < items.length - 1 && <Separator />}
          </div>
        )
      })}
    </div>
  )
}
