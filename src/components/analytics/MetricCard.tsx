import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { ArrowUp, ArrowDown, Minus } from '@phosphor-icons/react'

interface MetricCardProps {
  title: string
  value: string | number
  icon: React.ReactNode
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
  isUpdating?: boolean
}

export function MetricCard({ title, value, icon, trend = 'neutral', trendValue, isUpdating = false }: MetricCardProps) {
  const [showUpdatePulse, setShowUpdatePulse] = useState(false)
  const [prevValue, setPrevValue] = useState(value)

  useEffect(() => {
    if (value !== prevValue) {
      setShowUpdatePulse(true)
      setPrevValue(value)
      
      const timer = setTimeout(() => {
        setShowUpdatePulse(false)
      }, 1000)

      return () => clearTimeout(timer)
    }
  }, [value, prevValue])

  return (
    <Card className={`p-6 transition-all duration-300 ${showUpdatePulse ? 'ring-2 ring-accent shadow-lg' : ''}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <h3 className={`text-3xl font-bold mt-2 transition-all duration-300 ${showUpdatePulse ? 'scale-105 text-accent' : ''}`}>
            {value}
          </h3>
          {trendValue && (
            <div className="flex items-center gap-1 mt-2 text-sm">
              {trend === 'up' && (
                <>
                  <ArrowUp size={16} className="text-green-500" />
                  <span className="text-green-500">{trendValue}</span>
                </>
              )}
              {trend === 'down' && (
                <>
                  <ArrowDown size={16} className="text-red-500" />
                  <span className="text-red-500">{trendValue}</span>
                </>
              )}
              {trend === 'neutral' && (
                <>
                  <Minus size={16} className="text-muted-foreground" />
                  <span className="text-muted-foreground">{trendValue}</span>
                </>
              )}
            </div>
          )}
        </div>
        <div className={`flex items-center justify-center h-12 w-12 rounded-lg bg-primary/10 text-primary transition-all duration-300 ${showUpdatePulse ? 'scale-110' : ''}`}>
          {icon}
        </div>
      </div>
    </Card>
  )
}
