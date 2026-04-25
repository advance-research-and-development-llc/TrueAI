import { useMemo } from 'react'

interface CategoryBreakdownProps {
  data: { type: string; count: number }[]
}

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
]

export function CategoryBreakdown({ data }: CategoryBreakdownProps) {
  const total = useMemo(() => {
    return data.reduce((sum, d) => sum + d.count, 0)
  }, [data])

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground">
        No data available
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {data.slice(0, 5).map((item, index) => {
        const percentage = (item.count / total) * 100
        return (
          <div key={item.type} className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <span className="font-medium truncate max-w-[200px]">{item.type}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <span>{item.count}</span>
                <span className="text-xs">({percentage.toFixed(1)}%)</span>
              </div>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${percentage}%`,
                  backgroundColor: COLORS[index % COLORS.length]
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
