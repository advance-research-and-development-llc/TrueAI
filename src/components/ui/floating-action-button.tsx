import { motion } from 'framer-motion'
import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface FloatingActionButtonProps {
  onClick: () => void
  icon: ReactNode
  label?: string
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export function FloatingActionButton({
  onClick,
  icon,
  label,
  className,
  size = 'md'
}: FloatingActionButtonProps) {
  const sizeClasses = {
    sm: 'h-12 w-12',
    md: 'h-14 w-14',
    lg: 'h-16 w-16'
  }

  const iconSizes = {
    sm: 20,
    md: 24,
    lg: 28
  }

  return (
    <motion.button
      onClick={onClick}
      className={cn(
        'fixed bottom-20 sm:bottom-20 right-4 sm:right-6 z-40 rounded-full bg-gradient-to-br from-primary to-accent shadow-xl flex items-center justify-center text-white lg:hidden active:shadow-2xl safe-right',
        sizeClasses[size],
        className
      )}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.92 }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      transition={{
        type: 'spring',
        stiffness: 400,
        damping: 18
      }}
    >
      <div style={{ width: iconSizes[size], height: iconSizes[size] }}>
        {icon}
      </div>
      {label && (
        <span className="ml-2 font-medium text-sm whitespace-nowrap">
          {label}
        </span>
      )}
    </motion.button>
  )
}
