import type { FrameworkConfig } from './app-builder-types'

export const FRAMEWORK_CONFIGS: FrameworkConfig[] = [
  {
    id: 'vanilla',
    name: 'Vanilla JS',
    description: 'Pure JavaScript without any framework',
    icon: '⚡',
    color: 'oklch(0.85 0.14 60)',
    fileStructure: [
      { path: 'index.html', language: 'html', required: true },
      { path: 'app.js', language: 'javascript', required: true },
      { path: 'styles.css', language: 'css', required: true }
    ],
    buildInstructions: [
      'Validating HTML structure...',
      'Checking JavaScript syntax...',
      'Optimizing CSS...',
      'Build completed successfully!'
    ],
    features: [
      'No build step required',
      'Lightweight and fast',
      'Direct DOM manipulation',
      'Maximum browser compatibility'
    ]
  },
  {
    id: 'react',
    name: 'React',
    description: 'Component-based UI with hooks and modern React',
    icon: '⚛️',
    color: 'oklch(0.75 0.14 200)',
    fileStructure: [
      { path: 'index.html', language: 'html', required: true },
      { path: 'App.tsx', language: 'tsx', required: true },
      { path: 'main.tsx', language: 'tsx', required: true },
      { path: 'styles.css', language: 'css', required: true },
      { path: 'components/Button.tsx', language: 'tsx', required: false },
      { path: 'hooks/useLocalStorage.ts', language: 'typescript', required: false }
    ],
    buildInstructions: [
      'Initializing React build...',
      'Compiling TypeScript...',
      'Bundling components...',
      'Processing JSX/TSX...',
      'Optimizing assets...',
      'Build completed successfully!'
    ],
    features: [
      'React 19 with hooks',
      'TypeScript support',
      'Component composition',
      'State management with hooks',
      'Virtual DOM rendering',
      'Hot module replacement'
    ]
  },
  {
    id: 'vue',
    name: 'Vue 3',
    description: 'Progressive framework with Composition API',
    icon: '💚',
    color: 'oklch(0.65 0.18 160)',
    fileStructure: [
      { path: 'index.html', language: 'html', required: true },
      { path: 'App.vue', language: 'vue', required: true },
      { path: 'main.ts', language: 'typescript', required: true },
      { path: 'styles.css', language: 'css', required: true },
      { path: 'components/Button.vue', language: 'vue', required: false },
      { path: 'composables/useLocalStorage.ts', language: 'typescript', required: false }
    ],
    buildInstructions: [
      'Initializing Vue build...',
      'Compiling Vue components...',
      'Processing single-file components...',
      'Compiling TypeScript...',
      'Optimizing reactivity system...',
      'Build completed successfully!'
    ],
    features: [
      'Vue 3 Composition API',
      'Single-file components',
      'TypeScript integration',
      'Reactive data binding',
      'Scoped styling',
      'Built-in transitions'
    ]
  },
  {
    id: 'svelte',
    name: 'Svelte',
    description: 'Compile-time framework with no virtual DOM',
    icon: '🔥',
    color: 'oklch(0.65 0.20 25)',
    fileStructure: [
      { path: 'index.html', language: 'html', required: true },
      { path: 'App.svelte', language: 'svelte', required: true },
      { path: 'main.ts', language: 'typescript', required: true },
      { path: 'app.css', language: 'css', required: true },
      { path: 'components/Button.svelte', language: 'svelte', required: false },
      { path: 'stores/store.ts', language: 'typescript', required: false }
    ],
    buildInstructions: [
      'Initializing Svelte build...',
      'Compiling Svelte components...',
      'Processing reactive statements...',
      'Compiling TypeScript...',
      'Optimizing bundle size...',
      'Build completed successfully!'
    ],
    features: [
      'Truly reactive',
      'No virtual DOM overhead',
      'Built-in animations',
      'Scoped styles by default',
      'Smaller bundle sizes',
      'Compile-time optimization'
    ]
  }
]

export const getFrameworkConfig = (framework: string): FrameworkConfig | undefined => {
  return FRAMEWORK_CONFIGS.find(config => config.id === framework)
}

export const getFrameworkPromptInstructions = (framework: string): string => {
  const config = getFrameworkConfig(framework)
  if (!config) return ''

  switch (framework) {
    case 'react':
      return `
Use modern React 19 with TypeScript:
- Use functional components with hooks
- Use TypeScript for type safety
- Implement proper component composition
- Use CSS modules or inline styles
- Include proper prop types and interfaces
- Use useState, useEffect, and custom hooks as needed
- Make it production-ready with error boundaries
`

    case 'vue':
      return `
Use Vue 3 with Composition API and TypeScript:
- Use <script setup lang="ts"> syntax
- Implement reactive refs and computed properties
- Use proper component composition
- Include scoped styles with <style scoped>
- Add proper TypeScript types and interfaces
- Use composables for reusable logic
- Make it production-ready with error handling
`

    case 'svelte':
      return `
Use Svelte with TypeScript:
- Use <script lang="ts"> syntax
- Implement reactive statements with $:
- Use proper component composition
- Include scoped styles by default
- Add proper TypeScript types and interfaces
- Use Svelte stores for state management
- Make it production-ready with error handling
`

    default:
      return `
Use vanilla JavaScript:
- Use modern ES6+ syntax
- Implement clean, modular code
- Use proper error handling
- Make it responsive and accessible
- Include inline styles or external CSS
- Make it production-ready
`
  }
}
