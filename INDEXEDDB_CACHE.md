# IndexedDB Caching for Large Conversation Histories

## Overview

TrueAI LocalAI now includes IndexedDB caching to handle large conversation histories efficiently. This feature significantly improves performance when dealing with extensive chat logs, reduces memory usage, and provides offline access to historical conversations.

## Key Features

### 1. **Automatic Background Syncing**
- Conversations and messages are automatically cached to IndexedDB in the background
- Configurable sync intervals (default: 30 seconds)
- Syncs on visibility change and before page unload to prevent data loss

### 2. **Lazy Loading**
- Only loads recent messages into memory by default
- Older messages are kept in IndexedDB and loaded on-demand
- Configurable memory limits to optimize performance

### 3. **Smart Cache Management**
- Automatic cleanup of old data (default: 30 days)
- Size-based cache management (50MB limit by default)
- Manual cleanup and clear options

### 4. **Data Import/Export**
- Export entire cache as JSON for backup
- Import cache from backup files
- Useful for data migration and archival

### 5. **Real-time Statistics**
- Monitor cache size and usage
- Track number of cached conversations and messages
- View last sync and cleanup times

## Architecture

### Components

#### 1. **IndexedDB Manager** (`src/lib/indexeddb.ts`)
Core database management layer that handles:
- Database initialization and schema management
- CRUD operations for conversations and messages
- Cache statistics and metadata tracking
- Cleanup and maintenance operations

**Key Methods:**
```typescript
// Cache operations
await indexedDBManager.cacheConversation(conversation)
await indexedDBManager.cacheMessage(message)
await indexedDBManager.cacheMessages(messages)

// Retrieval
const conversation = await indexedDBManager.getCachedConversation(id)
const messages = await indexedDBManager.getCachedMessages(conversationId)
const all = await indexedDBManager.getAllCachedConversations()

// Management
await indexedDBManager.cleanup()
await indexedDBManager.clearAll()
const stats = await indexedDBManager.getCacheStats()

// Import/Export
const blob = await indexedDBManager.exportCache()
await indexedDBManager.importCache(data)
```

#### 2. **React Hook** (`src/hooks/use-indexeddb-cache.ts`)
Provides a React-friendly interface with automatic syncing:

```typescript
const {
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
} = useIndexedDBCache({
  enableAutoSync: true,
  syncInterval: 30000,
  enableLazyLoad: true,
  maxMemoryItems: 100
})
```

**Options:**
- `enableAutoSync`: Enable automatic background syncing
- `syncInterval`: Sync interval in milliseconds
- `enableLazyLoad`: Only load recent messages into memory
- `maxMemoryItems`: Maximum number of messages to keep in memory

#### 3. **UI Component** (`src/components/cache/IndexedDBCacheManager.tsx`)
Visual interface for cache management:
- Real-time cache statistics display
- Storage usage visualization with progress bar
- Manual sync, cleanup, and clear operations
- Import/Export functionality
- Visual sync status indicators

## Database Schema

### Object Stores

#### 1. **conversations**
```typescript
{
  id: string              // Primary key
  data: Conversation      // Full conversation object
  timestamp: number       // Cache timestamp
  size: number           // Size in bytes
}
```
**Indexes:**
- `timestamp`: For sorting and cleanup
- `size`: For cache management

#### 2. **messages**
```typescript
{
  id: string              // Primary key
  conversationId: string  // Foreign key to conversation
  data: Message          // Full message object
  timestamp: number       // Cache timestamp
}
```
**Indexes:**
- `conversationId`: For efficient conversation-based queries
- `timestamp`: For sorting and cleanup

#### 3. **metadata**
```typescript
{
  key: string            // Primary key
  totalSize: number      // Total cache size
  itemCount: number      // Number of items
  lastCleanup: number    // Last cleanup timestamp
  lastAccess: number     // Last access timestamp
}
```

## Usage

### Integration in App Component

```typescript
import { useIndexedDBCache } from '@/hooks/use-indexeddb-cache'

function App() {
  const indexedDBCache = useIndexedDBCache({
    enableAutoSync: true,
    syncInterval: 30000,
    enableLazyLoad: true,
    maxMemoryItems: 100
  })

  // Auto-sync conversations when they change
  useEffect(() => {
    if (indexedDBCache.isInitialized && conversations.length > 0) {
      conversations.forEach(conv => {
        indexedDBCache.cacheConversation(conv)
      })
    }
  }, [conversations, indexedDBCache.isInitialized])

  // Debounced sync for messages
  useEffect(() => {
    if (indexedDBCache.isInitialized && messages.length > 0) {
      const debouncedSync = setTimeout(() => {
        indexedDBCache.syncToCache()
      }, 1000)
      return () => clearTimeout(debouncedSync)
    }
  }, [messages, indexedDBCache.isInitialized])

  // Delete from cache when conversation is deleted
  const deleteConversation = (convId: string) => {
    setConversations(prev => prev.filter(c => c.id !== convId))
    setMessages(prev => prev.filter(m => m.conversationId !== convId))
    indexedDBCache.deleteConversationFromCache(convId)
  }
}
```

### Loading Specific Conversation Messages

```typescript
// Load all messages for a conversation from cache
const loadConversation = async (conversationId: string) => {
  const messages = await indexedDBCache.loadConversationMessages(conversationId)
  // Messages are automatically merged with current messages
}
```

### Manual Cache Operations

```typescript
// Force sync
await indexedDBCache.syncToCache()

// Cleanup old data
await indexedDBCache.cleanupCache()

// Clear all cache
await indexedDBCache.clearCache()

// Get statistics
const stats = await indexedDBCache.getCacheStats()
console.log(`Cached: ${stats.conversations} conversations, ${stats.messages} messages`)
console.log(`Total size: ${stats.totalSize} bytes`)

// Export cache
await indexedDBCache.exportCache()

// Import cache
await indexedDBCache.importCache(file)
```

## Performance Benefits

### 1. **Memory Optimization**
- **Before**: All conversations and messages loaded into memory (~10-50MB for large histories)
- **After**: Only recent messages in memory (~1-5MB), rest in IndexedDB

### 2. **Faster Initial Load**
- Lazy loading means faster app startup
- Progressive loading of conversation history as needed

### 3. **Offline Access**
- Full conversation history available offline
- No need to re-fetch data when offline

### 4. **Better Scalability**
- Can handle thousands of messages without performance degradation
- Automatic cleanup prevents indefinite growth

## Cache Management UI

Access the cache management interface:
1. Navigate to **Analytics** tab
2. Find the **IndexedDB Cache** card
3. View real-time statistics and perform management operations

### Available Operations

- **Sync Now**: Force immediate sync of current data
- **Cleanup**: Remove old data (>30 days) and optimize storage
- **Export**: Download cache as JSON file
- **Import**: Restore cache from JSON file
- **Refresh**: Update statistics display
- **Clear All**: Remove all cached data (requires confirmation)

### Visual Indicators

- **Storage Usage Bar**: Shows cache utilization with color coding
  - Green: <60% usage
  - Yellow: 60-80% usage
  - Red: >80% usage (warning to cleanup)

- **Sync Status Badge**:
  - "Syncing..." - Active sync in progress
  - "Synced" - Recently completed sync (shown for 2 seconds)
  - "Ready" - Idle state

## Configuration

### Adjusting Cache Limits

Edit `src/lib/indexeddb.ts`:

```typescript
class IndexedDBManager {
  // Maximum cache size (default: 50MB)
  private readonly MAX_CACHE_SIZE = 50 * 1024 * 1024
  
  // Cleanup when cache reaches this percentage (default: 80%)
  private readonly CLEANUP_THRESHOLD = 0.8
  
  // Maximum age of cached items (default: 30 days)
  private readonly MAX_AGE_DAYS = 30
}
```

### Adjusting Auto-Sync Settings

When initializing the hook:

```typescript
const indexedDBCache = useIndexedDBCache({
  enableAutoSync: true,        // Enable/disable auto-sync
  syncInterval: 60000,         // Sync every 60 seconds
  enableLazyLoad: true,        // Enable lazy loading
  maxMemoryItems: 50          // Keep only 50 most recent messages in memory
})
```

## Error Handling

The IndexedDB implementation includes comprehensive error handling:

1. **Initialization Failures**: Falls back gracefully if IndexedDB is unavailable
2. **Quota Exceeded**: Automatic cleanup triggered when storage limit reached
3. **Corrupted Data**: Individual operation failures don't affect overall functionality
4. **Browser Compatibility**: Checks for IndexedDB support before initialization

All errors are logged to console with descriptive messages for debugging.

## Browser Compatibility

IndexedDB is supported in:
- ✅ Chrome/Edge 24+
- ✅ Firefox 16+
- ✅ Safari 10+
- ✅ iOS Safari 10+
- ✅ Android Browser 4.4+

## Best Practices

### 1. **Regular Cleanup**
Run cleanup weekly or when cache usage exceeds 80%:
```typescript
await indexedDBCache.cleanupCache()
```

### 2. **Export Before Major Changes**
Create backups before clearing cache or major updates:
```typescript
await indexedDBCache.exportCache()
```

### 3. **Monitor Cache Size**
Check statistics regularly, especially for power users:
```typescript
const stats = await indexedDBCache.getCacheStats()
if (stats.totalSize > 40 * 1024 * 1024) {
  // Warn user or trigger cleanup
}
```

### 4. **Lazy Load for Large Histories**
For users with >1000 messages, enable lazy loading:
```typescript
const indexedDBCache = useIndexedDBCache({
  enableLazyLoad: true,
  maxMemoryItems: 100
})
```

### 5. **Debounce Sync Operations**
Don't sync on every message change; use debouncing:
```typescript
useEffect(() => {
  const timer = setTimeout(() => {
    indexedDBCache.syncToCache()
  }, 1000)
  return () => clearTimeout(timer)
}, [messages])
```

## Testing

### Verifying Cache Functionality

1. **Check Browser DevTools**:
   - Open DevTools → Application → IndexedDB
   - Look for `trueai-cache` database
   - Inspect `conversations` and `messages` stores

2. **Monitor Sync Status**:
   - Watch the sync badge in the UI
   - Check console for sync logs (if debug enabled)

3. **Test Offline Access**:
   - Create some conversations
   - Disconnect network
   - Verify conversations still load

4. **Test Export/Import**:
   - Export cache
   - Clear cache
   - Import from exported file
   - Verify data restored

## Troubleshooting

### Cache Not Syncing
1. Check `enableAutoSync` is true
2. Verify `isInitialized` is true
3. Check browser console for errors
4. Ensure IndexedDB is not disabled in browser

### High Memory Usage
1. Reduce `maxMemoryItems` in hook options
2. Enable `enableLazyLoad`
3. Run manual cleanup more frequently

### Slow Performance
1. Check cache size (may need cleanup)
2. Reduce `syncInterval` frequency
3. Disable auto-sync for batch operations

### Data Not Persisting
1. Check browser storage settings
2. Verify sufficient storage quota
3. Check if private/incognito mode is enabled
4. Clear corrupted IndexedDB and reinitialize

## Future Enhancements

Planned improvements:
- **Compression**: Compress cached data to save space
- **Incremental Sync**: Only sync changed data
- **Search Indexing**: Full-text search across cached messages
- **Encryption**: Encrypt cached data for security
- **Selective Sync**: Choose which conversations to cache
- **Cloud Sync**: Optional cloud backup integration

## Contributing

To contribute to IndexedDB caching improvements:

1. Test with large datasets (>10,000 messages)
2. Report performance issues with detailed metrics
3. Suggest optimization strategies
4. Submit PRs for new features or bug fixes

## License

Same as TrueAI LocalAI project license.
