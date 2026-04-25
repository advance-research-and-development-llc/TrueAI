import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Bell, CheckCircle, XCircle, Clock, Info } from '@phosphor-icons/react'
import type { Notification } from '@/lib/types'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'

interface NotificationCenterProps {
  notifications: Notification[]
  onMarkAsRead: (id: string) => void
  onClear: () => void
}

const getNotificationIcon = (type: Notification['type']) => {
  switch (type) {
    case 'agent_complete':
      return <CheckCircle weight="fill" size={20} className="text-green-400" />
    case 'agent_error':
      return <XCircle weight="fill" size={20} className="text-destructive" />
    case 'schedule_run':
      return <Clock weight="fill" size={20} className="text-accent" />
    default:
      return <Info weight="fill" size={20} className="text-primary" />
  }
}

export function NotificationCenter({ notifications, onMarkAsRead, onClear }: NotificationCenterProps) {
  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bell weight="fill" size={24} />
          <h3 className="font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Badge variant="default" className="h-5 min-w-5 px-1.5">
              {unreadCount}
            </Badge>
          )}
        </div>
        {notifications.length > 0 && (
          <Button variant="ghost" size="sm" onClick={onClear}>
            Clear All
          </Button>
        )}
      </div>

      <ScrollArea className="h-[400px] pr-4">
        <AnimatePresence>
          {notifications.length === 0 && (
            <p className="text-center text-muted-foreground py-12">
              No notifications
            </p>
          )}
          
          {notifications.map((notification) => (
            <motion.div
              key={notification.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="mb-3"
            >
              <Card
                className={cn(
                  'p-3 cursor-pointer hover:border-accent/50 transition-colors',
                  !notification.read && 'border-accent/30 bg-accent/5'
                )}
                onClick={() => onMarkAsRead(notification.id)}
              >
                <div className="flex gap-3">
                  <div className="mt-0.5">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-sm">{notification.title}</p>
                      {!notification.read && (
                        <div className="h-2 w-2 rounded-full bg-accent shrink-0 mt-1" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{notification.message}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(notification.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </ScrollArea>
    </Card>
  )
}
