import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { ReactNode } from 'react'

interface MobileBottomNavProps {
  items: Array<{
    id: string
    label: string
    icon: ReactNode
    active?: boolean
    onClick: () => void
  }>
}

export function MobileBottomNav({ items }: MobileBottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/98 backdrop-blur-xl border-t border-border lg:hidden shadow-lg">
      <div className="safe-bottom">
        <div className="flex items-center justify-around h-16 sm:h-14 px-2 safe-left safe-right">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={item.onClick}
              className={cn(
                'relative flex flex-col items-center justify-center gap-0.5 sm:gap-1 px-3 sm:px-4 py-2 min-w-[60px] sm:min-w-[64px] rounded-lg transition-all active:scale-95',
                item.active
                  ? 'text-accent'
                  : 'text-muted-foreground hover:text-foreground active:text-foreground'
              )}
            >
              {item.active && (
                <motion.div
                  layoutId="mobile-nav-indicator"
                  className="absolute inset-0 bg-accent/10 rounded-lg"
                  initial={false}
                  transition={{
                    type: 'spring',
                    stiffness: 500,
                    damping: 30
                  }}
                />
              )}
              <div className="relative z-10 flex flex-col items-center gap-0.5 sm:gap-1">
                <div className={cn('transition-transform', item.active && 'scale-110')}>
                  {item.icon}
                </div>
                <span className="text-[10px] sm:text-xs font-medium leading-none">{item.label}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </nav>
  )
}
