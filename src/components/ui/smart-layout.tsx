import { ReactNode, useMemo } from 'react'
import { useDynamicUI } from '@/hooks/use-dynamic-ui'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'

interface SmartContainerProps {
  children: ReactNode
  className?: string
  variant?: 'grid' | 'flex' | 'stack'
  adaptiveColumns?: boolean
}

export function SmartContainer({ 
  children, 
  className, 
  variant = 'grid',
  adaptiveColumns = true 
}: SmartContainerProps) {
  const { 
    preferences, 
    adaptiveLayout, 
    getSpacingClass, 
    getCardStyleClasses,
    getAnimationClasses 
  } = useDynamicUI()

  const containerClasses = useMemo(() => {
    const baseClasses = cn(
      getSpacingClass(),
      getAnimationClasses(),
      className
    )

    if (variant === 'grid') {
      const cols = adaptiveColumns 
        ? `grid-cols-1 md:grid-cols-${adaptiveLayout.columnCount}` 
        : 'grid-cols-1'
      return cn('grid', cols, baseClasses)
    }

    if (variant === 'flex') {
      return cn('flex flex-wrap', baseClasses)
    }

    return cn('flex flex-col', baseClasses)
  }, [variant, adaptiveColumns, adaptiveLayout.columnCount, getSpacingClass, getAnimationClasses, className])

  if (!preferences) {
    return <div className={className}>{children}</div>
  }

  if (preferences.animationIntensity === 'none') {
    return <div className={containerClasses}>{children}</div>
  }

  return (
    <motion.div
      className={containerClasses}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      {children}
    </motion.div>
  )
}

interface DynamicCardProps {
  children: ReactNode
  className?: string
  hoverable?: boolean
  contextColor?: 'default' | 'success' | 'warning' | 'error' | 'info'
}

export function DynamicCard({ 
  children, 
  className, 
  hoverable = false,
  contextColor = 'default' 
}: DynamicCardProps) {
  const { 
    preferences, 
    getPaddingClass, 
    getCardStyleClasses,
    getAnimationClasses 
  } = useDynamicUI()

  const contextColorClasses = useMemo(() => {
    if (!preferences?.contextualColors || contextColor === 'default') return ''

    switch (contextColor) {
      case 'success':
        return 'border-l-4 border-l-green-500'
      case 'warning':
        return 'border-l-4 border-l-yellow-500'
      case 'error':
        return 'border-l-4 border-l-red-500'
      case 'info':
        return 'border-l-4 border-l-blue-500'
      default:
        return ''
    }
  }, [preferences?.contextualColors, contextColor])

  const cardClasses = cn(
    getCardStyleClasses(),
    getPaddingClass(),
    getAnimationClasses(),
    contextColorClasses,
    hoverable && 'cursor-pointer',
    'rounded-lg',
    className
  )

  if (!preferences || preferences.animationIntensity === 'none') {
    return <div className={cardClasses}>{children}</div>
  }

  const hoverScale = preferences.animationIntensity === 'enhanced' ? 1.03 : 1.01

  return (
    <motion.div
      className={cardClasses}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={hoverable ? { scale: hoverScale } : undefined}
      transition={{ duration: 0.2 }}
    >
      {children}
    </motion.div>
  )
}

interface AdaptiveTextProps {
  children: ReactNode
  className?: string
  variant?: 'body' | 'heading' | 'caption'
}

export function AdaptiveText({ 
  children, 
  className, 
  variant = 'body' 
}: AdaptiveTextProps) {
  const { getFontSizeClass, preferences } = useDynamicUI()

  const textClasses = useMemo(() => {
    const baseSize = getFontSizeClass()
    
    let variantClass = ''
    if (variant === 'heading') {
      variantClass = 'font-semibold'
    } else if (variant === 'caption') {
      variantClass = 'text-muted-foreground'
    }

    return cn(baseSize, variantClass, className)
  }, [getFontSizeClass, variant, className])

  if (!preferences) {
    return <div className={className}>{children}</div>
  }

  return <div className={textClasses}>{children}</div>
}

interface ResponsiveSpacerProps {
  size?: 'small' | 'medium' | 'large'
}

export function ResponsiveSpacer({ size = 'medium' }: ResponsiveSpacerProps) {
  const { preferences } = useDynamicUI()

  if (!preferences) return <div className="h-4" />

  const heights: Record<typeof size, Record<typeof preferences.layoutDensity, string>> = {
    small: { compact: 'h-1', comfortable: 'h-2', spacious: 'h-3' },
    medium: { compact: 'h-2', comfortable: 'h-4', spacious: 'h-6' },
    large: { compact: 'h-4', comfortable: 'h-6', spacious: 'h-8' },
  }

  return <div className={heights[size][preferences.layoutDensity]} />
}

interface DynamicBackgroundProps {
  children: ReactNode
  className?: string
}

export function DynamicBackground({ children, className }: DynamicBackgroundProps) {
  const { preferences } = useDynamicUI()

  if (!preferences) {
    return <div className={className}>{children}</div>
  }

  const getBackgroundPattern = () => {
    switch (preferences.backgroundPattern) {
      case 'dots':
        return {
          backgroundImage: 'radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)',
          backgroundSize: '40px 40px',
        }
      case 'grid':
        return {
          backgroundImage: 'linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }
      case 'waves':
        return {
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 50 Q25 25 50 50 T100 50' fill='none' stroke='currentColor' stroke-width='0.5' opacity='0.1'/%3E%3C/svg%3E")`,
          backgroundSize: '100px 100px',
        }
      case 'gradient':
        return {
          background: 'linear-gradient(135deg, oklch(0.18 0.01 260) 0%, oklch(0.22 0.03 280) 50%, oklch(0.18 0.01 260) 100%)',
        }
      default:
        return {}
    }
  }

  return (
    <div 
      className={cn('relative', className)}
      style={getBackgroundPattern()}
    >
      {preferences.backgroundPattern !== 'none' && preferences.backgroundPattern !== 'gradient' && (
        <div className="absolute inset-0 opacity-[0.02] pointer-events-none text-foreground" />
      )}
      {children}
    </div>
  )
}
