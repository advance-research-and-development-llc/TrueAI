import { useState, useRef, useEffect } from 'react'
import { useIntersectionObserver, ImageCache } from '@/lib/mobile-performance'
import { Skeleton } from '@/components/ui/skeleton'

interface OptimizedImageProps {
  src: string
  alt: string
  width?: number | string
  height?: number | string
  className?: string
  placeholder?: string
  objectFit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down'
  loading?: 'lazy' | 'eager'
  onLoad?: () => void
  onError?: () => void
}

export function OptimizedImage({
  src,
  alt,
  width,
  height,
  className = '',
  placeholder,
  objectFit = 'cover',
  loading = 'lazy',
  onLoad,
  onError
}: OptimizedImageProps) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [imageSrc, setImageSrc] = useState<string | null>(
    loading === 'eager' ? src : null
  )
  const imgRef = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const isInView = useIntersectionObserver(containerRef, {
    rootMargin: '200px',
    threshold: 0.01
  })

  useEffect(() => {
    if (loading === 'lazy' && isInView && !imageSrc && !hasError) {
      if (ImageCache.has(src)) {
        setImageSrc(ImageCache.get(src)!)
        setIsLoaded(true)
      } else {
        setImageSrc(src)
      }
    }
  }, [isInView, src, imageSrc, hasError, loading])

  useEffect(() => {
    if (loading === 'eager' && !imageSrc) {
      setImageSrc(src)
    }
  }, [src, imageSrc, loading])

  const handleLoad = () => {
    setIsLoaded(true)
    ImageCache.set(src, src)
    onLoad?.()
  }

  const handleError = () => {
    setHasError(true)
    onError?.()
  }

  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
      style={{ width, height }}
    >
      {!isLoaded && !hasError && (
        <Skeleton
          className="absolute inset-0 w-full h-full"
          style={{ width, height }}
        />
      )}
      
      {imageSrc && !hasError && (
        <img
          ref={imgRef}
          src={imageSrc}
          alt={alt}
          className={`w-full h-full transition-opacity duration-300 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          style={{ objectFit }}
          onLoad={handleLoad}
          onError={handleError}
          loading={loading}
        />
      )}
      
      {hasError && placeholder && (
        <div className="flex items-center justify-center w-full h-full bg-muted text-muted-foreground text-sm">
          {placeholder}
        </div>
      )}
    </div>
  )
}
