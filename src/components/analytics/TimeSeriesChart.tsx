import { useMemo } from 'react'

interface TimeSeriesChartProps {
  data: { date: string; count: number }[]
}

export function TimeSeriesChart({ data }: TimeSeriesChartProps) {
  const maxValue = useMemo(() => {
    return Math.max(...data.map(d => d.count), 1)
  }, [data])

  const chartHeight = 200

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground">
        No data available
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="relative h-48">
        <svg viewBox={`0 0 ${data.length * 40} ${chartHeight}`} className="w-full h-full">
          <defs>
            <linearGradient id="chartGradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
            </linearGradient>
          </defs>

          <polyline
            fill="url(#chartGradient)"
            stroke="hsl(var(--primary))"
            strokeWidth="2"
            points={data.map((d, i) => {
              const x = i * 40 + 20
              const y = chartHeight - (d.count / maxValue) * (chartHeight - 40)
              return `${x},${y}`
            }).join(' ') + ` ${data.length * 40},${chartHeight} 0,${chartHeight}`}
          />

          {data.map((d, i) => {
            const x = i * 40 + 20
            const y = chartHeight - (d.count / maxValue) * (chartHeight - 40)
            return (
              <circle
                key={i}
                cx={x}
                cy={y}
                r="4"
                fill="hsl(var(--primary))"
                className="hover:r-6 transition-all cursor-pointer"
              >
                <title>{`${d.date}: ${d.count} events`}</title>
              </circle>
            )
          })}
        </svg>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground overflow-x-auto">
        {data.slice(0, 7).map((d, i) => (
          <div key={i} className="text-center min-w-[40px]">
            {new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </div>
        ))}
      </div>
    </div>
  )
}
