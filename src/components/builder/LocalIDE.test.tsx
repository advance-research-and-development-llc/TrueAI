import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

// Mock prismjs which doesn't work in jsdom
vi.mock('prismjs', () => ({
  default: {
    highlightElement: vi.fn(),
    highlight: vi.fn().mockReturnValue('<span>code</span>'),
    languages: {},
  },
}))

vi.mock('prismjs/components/prism-javascript', () => ({}))
vi.mock('prismjs/components/prism-typescript', () => ({}))
vi.mock('prismjs/components/prism-jsx', () => ({}))
vi.mock('prismjs/components/prism-tsx', () => ({}))
vi.mock('prismjs/components/prism-css', () => ({}))
vi.mock('prismjs/components/prism-markup', () => ({}))
vi.mock('prismjs/components/prism-json', () => ({}))
vi.mock('prismjs/plugins/line-numbers/prism-line-numbers', () => ({}))
vi.mock('prismjs/plugins/line-numbers/prism-line-numbers.css', () => ({}))

import { LocalIDE } from './LocalIDE'

describe('LocalIDE', () => {
  it('renders heading', () => {
    render(<LocalIDE />)
    expect(screen.getByText(/local ide/i)).toBeInTheDocument()
  })

  it('renders without crashing', () => {
    render(<LocalIDE />)
    expect(document.body).toBeTruthy()
  })
})
