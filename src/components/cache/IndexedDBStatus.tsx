import { memo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Database, CheckCircle, XCircle, ArrowsClockwise } from '@phosphor-icons/react'
import { useIndexedDBCache } from '@/hooks/use-indexeddb-cache'
import { motion } from 'framer-motion'

export const IndexedDBStatus = memo(() => {
  const { isInitialized, isSyncing, lastSyncTime } = useIndexedDBCache()

  const getStatusColor = () => {
    if (!isInitialized) return 'text-muted-foreground'
    if (isSyncing) return 'text-blue-500'
    return 'text-green-500'
  }

  const getStatusIcon = () => {
    if (!isInitialized) return <XCircle size={14} weight="fill" />
    if (isSyncing) {
      return (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <ArrowsClockwise size={14} weight="bold" />
        </motion.div>
      )
    }
    return <CheckCircle size={14} weight="fill" />
  }

  const getStatusText = () => {
    if (!isInitialized) return 'Initializing'
    if (isSyncing) return 'Syncing'
    return 'Cached'
  }

  const getTooltipText = () => {
    if (!isInitialized) return 'IndexedDB cache is initializing...'
    if (isSyncing) return 'Syncing data to IndexedDB cache'
    if (lastSyncTime) {
      const ago = Math.floor((Date.now() - lastSyncTime) / 1000)
      if (ago < 60) return `Last synced ${ago}s ago`
      if (ago < 3600) return `Last synced ${Math.floor(ago / 60)}m ago`
      return `Last synced ${Math.floor(ago / 3600)}h ago`
    }
    return 'IndexedDB cache ready'
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge 
          variant="outline" 
          className="gap-1.5 cursor-help hidden sm:flex"
        >
          <Database size={14} className={getStatusColor()} />
          <span className={getStatusColor()}>{getStatusIcon()}</span>
          <span className="text-xs">{getStatusText()}</span>
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <p>{getTooltipText()}</p>
      </TooltipContent>
    </Tooltip>
  )
})

IndexedDBStatus.displayName = 'IndexedDBStatus'
