# Mobile Performance Optimization Guide

This document outlines all the performance optimizations implemented in TrueAI LocalAI for mobile devices while maintaining visual aesthetics.

## Overview

The application now includes comprehensive performance optimization that automatically adapts to device capabilities, ensuring smooth performance on low-end, mid-tier, and high-end devices without sacrificing the visual appeal.

## Key Features

### 1. Automatic Device Detection

The app automatically detects device capabilities on startup:

- **CPU Cores**: Number of processing cores
- **Memory**: Available RAM
- **GPU**: Graphics capabilities
- **Network**: Connection speed (2g, 3g, 4g, 5g)
- **Battery**: Level and charging status
- **Data Saver Mode**: Respects user's data preferences

Based on these metrics, devices are categorized into three tiers:
- **Low-end**: < 30 performance score, < 2GB RAM, or slow connection
- **Mid-tier**: 30-60 performance score
- **High-end**: > 60 performance score and >= 6GB RAM

### 2. Adaptive Performance Settings

Settings automatically adjust based on device tier:

#### Low-End Devices
- Animations: **Disabled**
- Blur effects: **Disabled**
- Shadows: **Disabled**
- Max concurrent requests: **2**
- Image preloading: **Disabled**
- Cache size: **50 items**
- Debounce delay: **300ms**
- Throttle delay: **200ms**

#### Mid-Tier Devices (Default)
- Animations: **Enabled** (300ms duration)
- Blur effects: **Enabled**
- Shadows: **Enabled**
- Max concurrent requests: **6**
- Image preloading: **Enabled**
- Cache size: **100 items**
- Debounce delay: **150ms**
- Throttle delay: **100ms**

#### High-End Devices
- Animations: **Enhanced** (400ms duration)
- Blur effects: **Enabled**
- Shadows: **Enabled**
- Max concurrent requests: **10**
- Image preloading: **Enabled**
- Cache size: **200 items**
- Debounce delay: **100ms**
- Throttle delay: **50ms**

### 3. Component-Level Optimizations

#### Memoization
- **ConversationItem**: Memoized to prevent unnecessary re-renders
- **AgentCard**: Lazy loaded and memoized
- All heavy components wrapped in `React.memo()`

#### Code Splitting & Lazy Loading
All major components are lazy loaded:
- Agent components
- Model management UI
- Analytics dashboard
- Builder tools
- Settings panels

#### Virtual Scrolling
- Long lists automatically virtualize on mobile
- Only renders visible items + overscan buffer
- Dramatically reduces DOM nodes and memory

#### Image Optimization
- **OptimizedImage Component**: Lazy loads images with IntersectionObserver
- **Image Cache**: Prevents re-downloading previously loaded images
- **Skeleton Placeholders**: Shows during loading
- **Error Handling**: Graceful fallbacks

### 4. Real-Time Performance Monitoring

#### Performance Monitor Component
Displays in debug mode:
- **FPS (Frames Per Second)**: Real-time frame rate
- **Memory Usage**: JavaScript heap usage percentage
- **Device Info**: Tier, cores, memory, connection, battery
- **Color-coded Metrics**:
  - Green: Good performance (FPS ≥55, Memory <60%)
  - Yellow: Moderate (FPS 40-54, Memory 60-79%)
  - Red: Poor (FPS <40, Memory ≥80%)

Enable in Settings → Debug Mode

### 5. CSS Performance Optimizations

#### GPU Acceleration
- Critical animations use `transform` and `opacity` (GPU-accelerated)
- `.gpu-accelerated` utility class for complex elements
- `will-change` property for known animations

#### Reduced Motion Support
- Respects `prefers-reduced-motion` media query
- Animations automatically disabled for accessibility
- Transitions reduced to 0.01ms when motion is reduced

#### Mobile-Specific Optimizations
- `touch-action: manipulation` prevents tap delays
- `-webkit-overflow-scrolling: touch` for smooth scrolling
- Larger touch targets (44px minimum)
- No zoom on input focus (16px font size)

### 6. Utility Hooks

#### `useAutoPerformanceOptimization`
Automatically detects device and applies settings:
```typescript
const { settings, capabilities, isLowEnd, shouldReduceMotion } = useAutoPerformanceOptimization()
```

#### `useDebounce`
Delays function execution:
```typescript
const debouncedSearch = useDebounce(handleSearch, 150)
```

#### `useThrottle`
Limits function execution rate:
```typescript
const throttledScroll = useThrottle(handleScroll, 100)
```

#### `useIntersectionObserver`
Detects element visibility:
```typescript
const isVisible = useIntersectionObserver(elementRef, { threshold: 0.5 })
```

#### `usePerformanceMonitor`
Subscribes to real-time metrics:
```typescript
const { fps, memory } = usePerformanceMonitor()
```

### 7. Network Optimizations

#### Request Batching
- Multiple updates batched together
- Reduces network overhead
- Respects device tier concurrent request limits

#### Data Saver Mode
- Detects `navigator.connection.saveData`
- Reduces image quality
- Disables non-essential preloading
- Visual indicator when active

#### Offline Support
- Service worker caches assets
- Offline queue for failed requests
- Background sync when connection restored

### 8. Animation Optimizations

#### Conditional Animation
Animations automatically disabled on:
- Low-end devices
- Data saver mode
- Reduced motion preference
- Low battery (<20% and not charging)

#### Performance-Aware Transitions
- `getAnimationProps()` utility function
- Returns disabled animations for low-end
- Maintains smooth UX on capable devices

#### Framer Motion Best Practices
- Layout animations only on high-end
- Transform/opacity only (no layout properties)
- AnimatePresence with mode="popLayout"
- Stagger delays scale with device tier

### 9. Memory Management

#### Image Cache
- LRU cache with configurable size
- Automatic eviction of old entries
- Prevents memory leaks

#### Component Cleanup
- All event listeners properly removed
- Timeouts/intervals cleared
- Subscriptions unsubscribed

#### Garbage Collection
- Proper reference management
- No circular dependencies
- WeakMap/WeakSet where appropriate

### 10. Bundle Size Optimizations

#### Dynamic Imports
- Route-based code splitting
- Component-level lazy loading
- Vendor chunk splitting

#### Tree Shaking
- ES6 modules throughout
- No side-effect imports
- Minimal lodash usage

#### Asset Optimization
- SVG icons (vector, scales perfectly)
- WebP images where supported
- Compressed JavaScript

## Performance Metrics

### Target Metrics
- **First Contentful Paint**: <1.5s
- **Time to Interactive**: <3.5s
- **Largest Contentful Paint**: <2.5s
- **Cumulative Layout Shift**: <0.1
- **First Input Delay**: <100ms
- **Frame Rate**: ≥60 FPS (≥40 FPS on low-end)

### Memory Targets
- **Initial Load**: <50MB
- **Peak Usage**: <150MB (low-end), <300MB (high-end)
- **Idle State**: <100MB

## Best Practices for Developers

### When Adding New Components

1. **Wrap heavy components in lazy loading**:
```typescript
const MyComponent = lazy(() => import('./MyComponent'))
```

2. **Memoize pure components**:
```typescript
export const MyComponent = memo(function MyComponent(props) {
  // component code
})
```

3. **Use performance hooks**:
```typescript
const shouldAnimate = useOptimizedAnimation()
const debouncedFn = useDebounce(expensiveFn, 200)
```

4. **Check device tier before heavy operations**:
```typescript
const { isLowEnd } = useAutoPerformanceOptimization()
if (!isLowEnd) {
  // Perform heavy operation
}
```

5. **Optimize images**:
```typescript
<OptimizedImage
  src={imageSrc}
  alt="Description"
  loading="lazy"
  placeholder="Image not available"
/>
```

### When Adding Animations

1. **Use GPU-accelerated properties only**:
```css
/* Good */
transform: translateX(10px);
opacity: 0.5;

/* Bad - triggers layout */
left: 10px;
width: 100px;
```

2. **Check motion preferences**:
```typescript
const { shouldReduceMotion } = useAutoPerformanceOptimization()
const animationProps = shouldReduceMotion ? {} : { initial, animate, exit }
```

3. **Keep animations short**:
- Low-end: 0-150ms
- Mid-tier: 150-300ms
- High-end: 300-500ms

### When Handling Lists

1. **Use virtual scrolling for >50 items**:
```typescript
<VirtualList
  items={items}
  itemHeight={60}
  containerHeight={600}
  renderItem={(item) => <ItemComponent item={item} />}
/>
```

2. **Memoize list items**:
```typescript
const MemoizedItem = memo(ListItem)
```

3. **Use keys properly**:
```typescript
{items.map(item => <Item key={item.id} {...item} />)}
```

## Testing Performance

### Desktop DevTools
1. Open Chrome DevTools
2. Performance tab
3. Record interaction
4. Check for:
   - Long tasks (>50ms)
   - Layout thrashing
   - Memory leaks

### Mobile Testing
1. Chrome DevTools → Responsive Mode
2. Throttle CPU (4x slowdown)
3. Throttle Network (Slow 3G)
4. Test all interactions
5. Monitor FPS and memory

### Lighthouse
1. Run Lighthouse audit
2. Target scores:
   - Performance: >90
   - Accessibility: >95
   - Best Practices: >95

## Monitoring in Production

### Enable Debug Mode
Settings → Debug Mode → ON
- Performance monitor appears bottom-right
- Shows FPS, memory, device info
- Color-coded warnings

### Check Console
- Performance warnings for >16ms renders
- Memory warnings at 80%+ usage
- Network errors and retries

### Analytics Events
Performance tracked automatically:
- `device_tier`: Device classification
- `fps_drop`: When FPS <40
- `memory_high`: When usage >80%
- `slow_render`: Component >16ms

## Troubleshooting

### Low FPS (<40)
1. Check device tier - may be low-end
2. Disable non-essential animations
3. Reduce concurrent operations
4. Check for memory leaks

### High Memory Usage (>80%)
1. Clear image cache: `ImageCache.clear()`
2. Reduce cache sizes in settings
3. Close unused tabs
4. Check for leaked listeners

### Slow Interactions
1. Increase debounce/throttle delays
2. Reduce animation durations
3. Disable blur/shadows
4. Enable virtual scrolling

## Future Improvements

- [ ] Web Workers for heavy computations
- [ ] IndexedDB for large datasets
- [ ] Progressive image loading
- [ ] Request deduplication
- [ ] Smart prefetching
- [ ] Adaptive quality streaming
- [ ] Background task scheduling
- [ ] Memory pressure API integration

## Conclusion

These optimizations ensure TrueAI LocalAI performs smoothly across all devices while maintaining its beautiful, modern interface. The system automatically adapts to device capabilities, providing the best possible experience for each user.
