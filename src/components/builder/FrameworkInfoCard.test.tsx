import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { FrameworkInfoCard } from './FrameworkInfoCard'
import type { FrameworkConfig } from '@/lib/app-builder-types'

const mockFramework: FrameworkConfig = {
  id: 'react',
  name: 'React',
  description: 'A JavaScript library for building user interfaces',
  icon: '⚛️',
  color: 'blue',
  features: [
    'Component-based architecture',
    'Virtual DOM for performance',
    'Large ecosystem',
  ],
  fileStructure: [
    { path: 'src/App.tsx', language: 'tsx', required: true },
    { path: 'src/main.tsx', language: 'tsx', required: true },
    { path: 'index.html', language: 'html', required: true },
  ],
  buildInstructions: ['npm install', 'npm run build'],
}

describe('FrameworkInfoCard', () => {
  it('renders framework name', () => {
    render(<FrameworkInfoCard framework={mockFramework} />)
    expect(screen.getByText('React')).toBeInTheDocument()
  })

  it('renders framework description', () => {
    render(<FrameworkInfoCard framework={mockFramework} />)
    expect(screen.getByText('A JavaScript library for building user interfaces')).toBeInTheDocument()
  })

  it('renders framework icon', () => {
    render(<FrameworkInfoCard framework={mockFramework} />)
    expect(screen.getByText('⚛️')).toBeInTheDocument()
  })

  it('renders all features', () => {
    render(<FrameworkInfoCard framework={mockFramework} />)
    expect(screen.getByText('Component-based architecture')).toBeInTheDocument()
    expect(screen.getByText('Virtual DOM for performance')).toBeInTheDocument()
    expect(screen.getByText('Large ecosystem')).toBeInTheDocument()
  })

  it('renders file structure paths', () => {
    render(<FrameworkInfoCard framework={mockFramework} />)
    expect(screen.getByText('src/App.tsx')).toBeInTheDocument()
    expect(screen.getByText('src/main.tsx')).toBeInTheDocument()
    expect(screen.getByText('index.html')).toBeInTheDocument()
  })

  it('renders language badges for file structure', () => {
    render(<FrameworkInfoCard framework={mockFramework} />)
    // tsx badge should appear
    const badges = screen.getAllByText('tsx')
    expect(badges.length).toBeGreaterThanOrEqual(1)
  })

  it('renders "Key Features" section heading', () => {
    render(<FrameworkInfoCard framework={mockFramework} />)
    expect(screen.getByText('Key Features')).toBeInTheDocument()
  })

  it('renders "File Structure" section heading', () => {
    render(<FrameworkInfoCard framework={mockFramework} />)
    expect(screen.getByText('File Structure')).toBeInTheDocument()
  })
})
