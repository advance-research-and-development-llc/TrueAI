import { ReactNode, useEffect } from 'react'
import { useAutoPerformanceOptimization } from '@/hooks/use-auto-performance'
import { MobilePerformanceOptimizer } from '@/lib/mobile-performance'
import { ResourceLoader, optimizeResourceLoading } from '@/lib/resource-loader'

interface PerformanceWrapperProps {
  children: ReactNode
}

export function PerformanceWrapper({ children }: PerformanceWrapperProps) {
  const { capabilities, isOptimized } = useAutoPerformanceOptimization()

  useEffect(() => {
    if (!isOptimized || !capabilities) return

    const optimizer = MobilePerformanceOptimizer.getInstance()
    const resourceLoader = ResourceLoader.getInstance()

    optimizeResourceLoading(capabilities.tier)

    const settings = optimizer.getOptimizedSettings(capabilities)
    
    document.documentElement.style.setProperty(
      '--animation-duration',
      `${settings.animationDuration}ms`
    )

    if (capabilities.tier === 'low') {
      document.body.classList.add('low-performance-mode')
      
      const style = document.createElement('style')
      style.textContent = `
        .low-performance-mode * {
          animation-duration: 0.01ms !important;
          transition-duration: 0.01ms !important;
        }
        .low-performance-mode .backdrop-blur-sm,
        .low-performance-mode .backdrop-blur-md,
        .low-performance-mode .backdrop-blur-lg,
        .low-performance-mode .backdrop-blur-xl {
          backdrop-filter: none !important;
        }
        .low-performance-mode .shadow-sm,
        .low-performance-mode .shadow,
        .low-performance-mode .shadow-md,
        .low-performance-mode .shadow-lg,
        .low-performance-mode .shadow-xl,
        .low-performance-mode .shadow-2xl {
          box-shadow: none !important;
        }
      `
      document.head.appendChild(style)
    }

    if (capabilities.saveData) {
      document.body.classList.add('save-data-mode')
    }

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration > 50) {
          console.warn(`Long task detected: ${entry.duration.toFixed(2)}ms`)
        }
      }
    })

    if ('PerformanceObserver' in window) {
      try {
        observer.observe({ entryTypes: ['longtask'] })
      } catch (e) {
        console.info('Long task monitoring not available')
      }
    }

    return () => {
      observer.disconnect()
    }
  }, [capabilities, isOptimized])

  return <>{children}</>
}
