type Priority = 'critical' | 'high' | 'medium' | 'low'

interface ResourceTask {
  id: string
  priority: Priority
  execute: () => Promise<void>
  timeout?: number
}

export class ResourceLoader {
  private static instance: ResourceLoader
  private queue: ResourceTask[] = []
  private scheduled = false
  private concurrent = 3
  private activeCount = 0

  static getInstance(): ResourceLoader {
    if (!this.instance) {
      this.instance = new ResourceLoader()
    }
    return this.instance
  }

  setConcurrency(limit: number) {
    this.concurrent = limit
  }

  addTask(task: ResourceTask) {
    this.queue.push(task)
    this.queue.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
      return priorityOrder[a.priority] - priorityOrder[b.priority]
    })

    this.scheduleProcess()
  }

  private scheduleProcess() {
    if (this.scheduled) return
    this.scheduled = true
    setTimeout(() => {
      this.scheduled = false
      this.process()
    }, 0)
  }

  private process() {
    while (this.activeCount < this.concurrent && this.queue.length > 0) {
      const task = this.queue.shift()
      if (!task) break
      this.activeCount++
      this.executeTask(task).finally(() => {
        this.activeCount = Math.max(0, this.activeCount - 1)
        if (this.queue.length > 0) {
          this.scheduleProcess()
        }
      })
    }
  }

  private async executeTask(task: ResourceTask) {
    try {
      if (task.timeout) {
        await Promise.race([
          task.execute(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Task timeout')), task.timeout)
          )
        ])
      } else {
        await task.execute()
      }
    } catch (error) {
      console.error(`Task ${task.id} failed:`, error)
    }
  }

  clear() {
    this.queue = []
    this.scheduled = false
    this.activeCount = 0
  }

  getQueueSize(): number {
    return this.queue.length
  }
}

export function preloadCriticalResources(resources: string[]) {
  const loader = ResourceLoader.getInstance()

  resources.forEach((src, index) => {
    loader.addTask({
      id: `critical-${index}`,
      priority: 'critical',
      execute: async () => {
        const link = document.createElement('link')
        link.rel = 'preload'
        link.setAttribute('as', 'fetch')
        link.href = src
        document.head.appendChild(link)
      }
    })
  })
}

export function preloadFont(fontFamily: string, fontUrl: string) {
  const loader = ResourceLoader.getInstance()

  loader.addTask({
    id: `font-${fontFamily}`,
    priority: 'high',
    execute: async () => {
      const link = document.createElement('link')
      link.rel = 'preload'
      link.setAttribute('as', 'font')
      link.type = 'font/woff2'
      link.href = fontUrl
      link.crossOrigin = 'anonymous'
      document.head.appendChild(link)
    }
  })
}

export function deferNonCriticalScripts() {
  const scripts = document.querySelectorAll('script[data-defer="true"]')
  
  const loader = ResourceLoader.getInstance()

  scripts.forEach((script, index) => {
    loader.addTask({
      id: `script-${index}`,
      priority: 'low',
      execute: async () => {
        const src = script.getAttribute('src')
        if (src) {
          const newScript = document.createElement('script')
          newScript.src = src
          newScript.async = true
          document.body.appendChild(newScript)
        }
      }
    })
  })
}

export function optimizeResourceLoading(deviceTier: 'low' | 'mid' | 'high') {
  const loader = ResourceLoader.getInstance()

  switch (deviceTier) {
    case 'low':
      loader.setConcurrency(2)
      break
    case 'mid':
      loader.setConcurrency(4)
      break
    case 'high':
      loader.setConcurrency(8)
      break
  }
}
