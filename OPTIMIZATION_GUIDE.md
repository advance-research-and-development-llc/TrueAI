# React Component Optimization Guide

This guide provides best practices for maintaining performance in the TrueAI LocalAI application as new features are added.

## Quick Reference

| Optimization | When to Use | Example |
|--------------|-------------|---------|
| `useMemo` | Expensive computations, array filtering/mapping | `useMemo(() => items.filter(...), [items])` |
| `useCallback` | Event handlers passed to child components | `useCallback(() => handleClick(), [deps])` |
| `React.memo` | Pure components that re-render often | `const Component = memo((props) => ...)` |
| `React.lazy` | Large feature components | `const Feature = lazy(() => import('./Feature'))` |
| `Suspense` | Wrapping lazy-loaded components | `<Suspense fallback={<Loading />}>` |

## Detailed Guidelines

### 1. When to Use `useMemo`

**Use for:**
- Filtering large arrays
- Mapping/transforming data
- Complex calculations
- Creating object maps from arrays
- Expensive string operations

**Example:**
```typescript
// ✅ Good - memoized filtering
const activeItems = useMemo(() => 
  items.filter(item => item.status === 'active'),
  [items]
)

// ❌ Bad - filters on every render
const activeItems = items.filter(item => item.status === 'active')
```

**Don't use for:**
- Simple primitive values
- Values that change on every render
- Objects/arrays created in render (use `useCallback` or define outside component)

### 2. When to Use `useCallback`

**Use for:**
- Event handlers passed to child components
- Functions passed as props
- Functions used in useEffect dependencies
- Callbacks passed to custom hooks

**Example:**
```typescript
// ✅ Good - stable function reference
const handleDelete = useCallback((id: string) => {
  setItems(prev => prev.filter(item => item.id !== id))
}, [])

// ❌ Bad - new function on every render
const handleDelete = (id: string) => {
  setItems(prev => prev.filter(item => item.id !== id))
}
```

**Pro tip:** Always use functional updates with setState when you don't need the current value in dependencies:

```typescript
// ✅ Good - no dependencies needed
const addItem = useCallback((item) => {
  setItems(prev => [...prev, item])
}, [])

// ❌ Bad - items in dependencies causes re-creation
const addItem = useCallback((item) => {
  setItems([...items, item])
}, [items])
```

### 3. When to Use `React.memo`

**Use for:**
- Presentational components that receive props
- Components that re-render frequently with same props
- List item components
- Form field components

**Example:**
```typescript
// ✅ Good - prevents re-renders when props don't change
const MessageBubble = memo(({ message }: { message: Message }) => {
  return (
    <div className="message">
      <p>{message.content}</p>
      <span>{message.timestamp}</span>
    </div>
  )
})

// For custom comparison:
const MessageBubble = memo(
  ({ message }: { message: Message }) => { /* ... */ },
  (prevProps, nextProps) => prevProps.message.id === nextProps.message.id
)
```

**Don't use for:**
- Components that always receive different props
- Components that rarely re-render
- Very simple components (overhead > benefit)

### 4. When to Use `React.lazy` and `Suspense`

**Use for:**
- Large feature components (>50KB)
- Route components
- Modal/dialog content
- Tab panel content
- Components with heavy dependencies (charts, editors, etc.)

**Example:**
```typescript
// ✅ Good - lazy load heavy component
const ChartComponent = lazy(() => import('./ChartComponent'))

function Dashboard() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <ChartComponent data={data} />
    </Suspense>
  )
}
```

**Directory structure for code splitting:**
```
components/
  feature/
    index.tsx          # Lazy wrapper
    FeatureMain.tsx    # Main component
    FeatureChild.tsx   # Child components
```

```typescript
// components/feature/index.tsx
export { default } from './FeatureMain'

// App.tsx
const Feature = lazy(() => import('@/components/feature'))
```

### 5. Optimization Patterns for Common Scenarios

#### Pattern: List Rendering

```typescript
function ItemList({ items }: { items: Item[] }) {
  // Memoize filtered list
  const visibleItems = useMemo(() => 
    items.filter(item => !item.hidden),
    [items]
  )

  // Stable callback
  const handleItemClick = useCallback((id: string) => {
    // handle click
  }, [])

  return (
    <div>
      {visibleItems.map(item => (
        <ListItem 
          key={item.id}
          item={item}
          onClick={handleItemClick}
        />
      ))}
    </div>
  )
}

// Memoized list item
const ListItem = memo(({ item, onClick }: Props) => {
  return (
    <div onClick={() => onClick(item.id)}>
      {item.name}
    </div>
  )
})
```

#### Pattern: Form Handlers

```typescript
function Form() {
  const [formData, setFormData] = useState({})

  // ✅ Good - uses functional update
  const handleChange = useCallback((field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }, [])

  // ✅ Good - stable submit handler
  const handleSubmit = useCallback(async () => {
    await submitForm(formData)
  }, [formData]) // formData dependency is intentional here

  return (
    <form onSubmit={handleSubmit}>
      <Input onChange={(e) => handleChange('name', e.target.value)} />
    </form>
  )
}
```

#### Pattern: Derived State

```typescript
function UserDashboard({ users }: { users: User[] }) {
  // ✅ Good - derive state with useMemo
  const stats = useMemo(() => ({
    total: users.length,
    active: users.filter(u => u.isActive).length,
    premium: users.filter(u => u.isPremium).length
  }), [users])

  // ❌ Bad - separate state that needs syncing
  const [totalUsers, setTotalUsers] = useState(0)
  useEffect(() => {
    setTotalUsers(users.length) // Extra state + effect
  }, [users])
}
```

### 6. Debugging Performance Issues

#### Use React DevTools Profiler

1. Install React DevTools extension
2. Go to Profiler tab
3. Click record
4. Interact with your app
5. Stop recording
6. Look for:
   - Components that render frequently
   - Components with long render times
   - Components rendering unnecessarily

#### Check Dependency Arrays

Common mistakes:
```typescript
// ❌ Missing dependencies
useEffect(() => {
  fetchData(userId)
}, []) // userId should be in deps

// ❌ Object/array in dependencies (always new reference)
const config = { url: '/api', userId }
useEffect(() => {
  fetchData(config)
}, [config]) // config is new object every render

// ✅ Good - primitive dependencies
useEffect(() => {
  fetchData('/api', userId)
}, [userId])

// ✅ Good - memoized object
const config = useMemo(() => ({ url: '/api', userId }), [userId])
useEffect(() => {
  fetchData(config)
}, [config])
```

### 7. Common Anti-Patterns to Avoid

```typescript
// ❌ Creating objects/arrays in render
function Component() {
  const style = { color: 'red' } // New object every render
  const items = ['a', 'b', 'c']   // New array every render
  
  return <Child style={style} items={items} />
}

// ✅ Move outside component or use useMemo
const DEFAULT_STYLE = { color: 'red' }
const DEFAULT_ITEMS = ['a', 'b', 'c']

function Component() {
  return <Child style={DEFAULT_STYLE} items={DEFAULT_ITEMS} />
}

// Or if dynamic:
function Component({ color }: Props) {
  const style = useMemo(() => ({ color }), [color])
  return <Child style={style} />
}
```

```typescript
// ❌ Inline arrow functions for callbacks
<Button onClick={() => handleClick(id)} />

// ✅ Use useCallback
const handleButtonClick = useCallback(() => {
  handleClick(id)
}, [id])
<Button onClick={handleButtonClick} />
```

### 8. Bundle Size Optimization

**Check your imports:**
```typescript
// ❌ Imports entire library
import _ from 'lodash'
const result = _.chunk(array, 2)

// ✅ Import only what you need
import chunk from 'lodash/chunk'
const result = chunk(array, 2)
```

**For icon libraries:**
```typescript
// ❌ Imports all icons
import * as Icons from '@phosphor-icons/react'

// ✅ Import specific icons
import { Heart, Star, Plus } from '@phosphor-icons/react'
```

### 9. Mobile-Specific Optimizations

```typescript
function MobileOptimizedList({ items }: Props) {
  const isMobile = useIsMobile()
  
  // Show fewer items on mobile
  const displayItems = useMemo(() => 
    isMobile ? items.slice(0, 20) : items,
    [items, isMobile]
  )
  
  // Lazy load heavy components only on desktop
  const HeavyComponent = useMemo(
    () => !isMobile ? lazy(() => import('./HeavyComponent')) : null,
    [isMobile]
  )
  
  return (
    <div>
      {displayItems.map(item => <Item key={item.id} item={item} />)}
      {HeavyComponent && (
        <Suspense fallback={<Loading />}>
          <HeavyComponent />
        </Suspense>
      )}
    </div>
  )
}
```

### 10. Measuring Performance

Add performance marks for critical user flows:

```typescript
function ExpensiveOperation() {
  useEffect(() => {
    performance.mark('operation-start')
    
    // Do expensive work
    doWork()
    
    performance.mark('operation-end')
    performance.measure('operation', 'operation-start', 'operation-end')
    
    const measure = performance.getEntriesByName('operation')[0]
    console.log('Operation took:', measure.duration, 'ms')
    
    // Clean up
    performance.clearMarks()
    performance.clearMeasures()
  }, [])
}
```

## Checklist for New Components

- [ ] Large components (>50KB) are lazy-loaded
- [ ] Event handlers use `useCallback`
- [ ] Expensive computations use `useMemo`
- [ ] Pure components use `React.memo`
- [ ] No objects/arrays created in render
- [ ] Dependency arrays are correct
- [ ] No unnecessary re-renders in DevTools Profiler
- [ ] Component works smoothly on mobile devices

## Resources

- [React Performance Optimization](https://react.dev/learn/render-and-commit)
- [When to useMemo and useCallback](https://kentcdodds.com/blog/usememo-and-usecallback)
- [React DevTools Profiler](https://react.dev/learn/react-developer-tools)
- [Code Splitting](https://react.dev/reference/react/lazy)
