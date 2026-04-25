import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  illustration: string
  title: string
  description?: string
  action?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function EmptyState({
  illustration,
  title,
  description,
  action,
  size = 'md',
  className
}: EmptyStateProps) {
  const sizes = {
    sm: 'w-24 h-24',
    md: 'w-32 h-32',
    lg: 'w-48 h-48'
  }

  const titleSizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg'
  }

  return (
    <div className={cn('flex flex-col items-center justify-center py-12 px-4', className)}>
      <img 
        src={illustration} 
        alt={title}
        className={cn(sizes[size], 'mb-4 opacity-80')} 
      />
      <p className={cn('text-center text-muted-foreground font-medium mb-2', titleSizes[size])}>
        {title}
      </p>
      {description && (
        <p className="text-center text-muted-foreground/70 text-sm max-w-md">
          {description}
        </p>
      )}
      {action && (
        <div className="mt-4">
          {action}
        </div>
      )}
    </div>
  )
}
