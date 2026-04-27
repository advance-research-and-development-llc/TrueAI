import { useEffect, useCallback, useRef } from 'react'
import { useKV } from '@github/spark/hooks'
import { indexedDBManager, syncToIndexedDB, loadFromIndexedDB } from '@/lib/indexeddb'
import type { Conversation, Message } from '@/lib/types'

export interface UseIndexedDBCacheOptions {
  enableAutoSync?: boolean
  syncInterval?: number
  enableLazyLoad?: boolean
  maxMemoryItems?: number
}

export function useIndexedDBCache(options: UseIndexedDBCacheOptions = {}) {
  const {
    enableAutoSync = true,
    syncInterval = 30000,
    enableLazyLoad = true,
    maxMemoryItems = 100
  } = options

  const [conversations, setConversations] = useKV<Conversation[]>('conversations', [])
  const [messages, setMessages] = useKV<Message[]>('messages', [])
  const [isSyncing, setIsSyncing] = useKV<boolean>('indexeddb-syncing', false)
  const [isInitialized, setIsInitialized] = useKV<boolean>('indexeddb-initialized', false)
  const [lastSyncTime, setLastSyncTime] = useKV<number>('indexeddb-last-sync', 0)
  
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const conversationsRef = useRef<Conversation[]>([])
  const messagesRef = useRef<Message[]>([])

  useEffect(() => {
    conversationsRef.current = conversations || []
  }, [conversations])

  useEffect(() => {
    messagesRef.current = messages || []
  }, [messages])

  const syncToCache = useCallback(async () => {
    if (isSyncing) return

    setIsSyncing(true)
    try {
      await syncToIndexedDB(conversationsRef.current, messagesRef.current)
      setLastSyncTime(Date.now())
    } catch (error) {
      console.error('Failed to sync to IndexedDB:', error)
    } finally {
      setIsSyncing(false)
    }
  }, [isSyncing, setIsSyncing, setLastSyncTime])

  const loadFromCache = useCallback(async () => {
    try {
      const cached = await loadFromIndexedDB()
      
      if (cached.conversations.length > 0) {
        setConversations(cached.conversations)
      }
      
      if (cached.messages.length > 0) {
        if (enableLazyLoad && cached.messages.length > maxMemoryItems) {
          const recentMessages = cached.messages.slice(-maxMemoryItems)
          setMessages(recentMessages)
        } else {
          setMessages(cached.messages)
        }
      }
      
      setIsInitialized(true)
    } catch (error) {
      console.error('Failed to load from IndexedDB:', error)
      setIsInitialized(true)
    }
  }, [setConversations, setMessages, setIsInitialized, enableLazyLoad, maxMemoryItems])

  const loadConversationMessages = useCallback(async (conversationId: string) => {
    try {
      const cachedMessages = await indexedDBManager.getCachedMessages(conversationId)
      
      const currentMessages = messagesRef.current
      const existingIds = new Set(currentMessages.map(m => m.id))
      const newMessages = cachedMessages.filter(m => !existingIds.has(m.id))
      
      if (newMessages.length > 0) {
        setMessages((prev) => {
          const combined = [...(prev || []), ...newMessages]
          return combined.sort((a, b) => a.timestamp - b.timestamp)
        })
      }
      
      return cachedMessages
    } catch (error) {
      console.error('Failed to load conversation messages:', error)
      return []
    }
  }, [setMessages])

  const cacheConversation = useCallback(async (conversation: Conversation) => {
    try {
      await indexedDBManager.cacheConversation(conversation)
    } catch (error) {
      console.error('Failed to cache conversation:', error)
    }
  }, [])

  const cacheMessage = useCallback(async (message: Message) => {
    try {
      await indexedDBManager.cacheMessage(message)
    } catch (error) {
      console.error('Failed to cache message:', error)
    }
  }, [])

  const deleteConversationFromCache = useCallback(async (conversationId: string) => {
    try {
      await indexedDBManager.deleteConversationCache(conversationId)
    } catch (error) {
      console.error('Failed to delete conversation from cache:', error)
    }
  }, [])

  const getCacheStats = useCallback(async () => {
    try {
      return await indexedDBManager.getCacheStats()
    } catch (error) {
      console.error('Failed to get cache stats:', error)
      return {
        conversations: 0,
        messages: 0,
        totalSize: 0
      }
    }
  }, [])

  const cleanupCache = useCallback(async () => {
    try {
      await indexedDBManager.cleanup()
    } catch (error) {
      console.error('Failed to cleanup cache:', error)
    }
  }, [])

  const clearCache = useCallback(async () => {
    try {
      await indexedDBManager.clearAll()
      setLastSyncTime(0)
    } catch (error) {
      console.error('Failed to clear cache:', error)
    }
  }, [setLastSyncTime])

  const exportCache = useCallback(async () => {
    try {
      const blob = await indexedDBManager.exportCache()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `trueai-cache-${Date.now()}.json`
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to export cache:', error)
    }
  }, [])

  const importCache = useCallback(async (file: File) => {
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      
      if (data.conversations && data.messages) {
        await indexedDBManager.importCache(data)
        await loadFromCache()
      }
    } catch (error) {
      console.error('Failed to import cache:', error)
    }
  }, [loadFromCache])

  useEffect(() => {
    loadFromCache()

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current)
      }
    }
  }, [loadFromCache])

  useEffect(() => {
    if (!enableAutoSync || !isInitialized) return

    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current)
    }

    syncIntervalRef.current = setInterval(() => {
      syncToCache()
    }, syncInterval)

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current)
      }
    }
  }, [enableAutoSync, isInitialized, syncInterval, syncToCache])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && enableAutoSync) {
        syncToCache()
      }
    }

    const handleBeforeUnload = () => {
      if (enableAutoSync) {
        syncToCache()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [enableAutoSync, syncToCache])

  return {
    isInitialized,
    isSyncing,
    lastSyncTime,
    syncToCache,
    loadFromCache,
    loadConversationMessages,
    cacheConversation,
    cacheMessage,
    deleteConversationFromCache,
    getCacheStats,
    cleanupCache,
    clearCache,
    exportCache,
    importCache
  }
}
