import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'
import type { Conversation } from '@/lib/types'

interface ConversationItemProps {
  conversation: Conversation
  isActive: boolean
  onClick: () => void
  index: number
}

export const ConversationItem = memo(function ConversationItem({
  conversation,
  isActive,
  onClick,
  index
}: ConversationItemProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ delay: index * 0.05, duration: 0.2 }}
      whileHover={{ x: 4 }}
    >
      <Button
        variant={isActive ? 'secondary' : 'ghost'}
        className="w-full justify-start text-left h-auto py-3 px-4 transition-all duration-200 hover:shadow-md"
        onClick={onClick}
      >
        <div className="flex-1 min-w-0">
          <p className="truncate font-medium text-sm sm:text-base">{conversation.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {new Date(conversation.updatedAt).toLocaleDateString()}
          </p>
        </div>
      </Button>
    </motion.div>
  )
})
