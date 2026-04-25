import { Message } from '@/lib/types'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { User, Robot } from '@phosphor-icons/react'
import { motion } from 'framer-motion'

interface MessageBubbleProps {
  message: Message
  isStreaming?: boolean
}

export function MessageBubble({ message, isStreaming }: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        'flex gap-3 my-3',
        isUser && 'flex-row-reverse'
      )}
    >
      <Avatar className={cn(
        'h-8 w-8 shrink-0',
        isSystem && 'opacity-50'
      )}>
        <AvatarFallback className={cn(
          isUser && 'bg-accent text-accent-foreground',
          !isUser && 'bg-primary text-primary-foreground'
        )}>
          {isUser ? <User weight="bold" size={18} /> : <Robot weight="bold" size={18} />}
        </AvatarFallback>
      </Avatar>

      <div className={cn(
        'flex flex-col gap-1 max-w-[80%]',
        isUser && 'items-end'
      )}>
        <div className={cn(
          'px-4 py-2 rounded-lg',
          isUser && 'bg-accent text-accent-foreground',
          !isUser && 'bg-card text-card-foreground border border-border',
          isSystem && 'bg-muted text-muted-foreground italic'
        )}>
          <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">
            {message.content}
            {isStreaming && (
              <span className="inline-block w-2 h-4 ml-1 bg-current animate-pulse-glow" />
            )}
          </p>
        </div>
        
        <span className="text-[13px] text-muted-foreground px-2">
          {new Date(message.timestamp).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
          {message.model && ` • ${message.model}`}
        </span>
      </div>
    </motion.div>
  )
}
