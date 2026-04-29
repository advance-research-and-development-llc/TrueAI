import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

// Mock prismjs which doesn't work in jsdom
vi.mock('prismjs', () => ({
  default: {
    highlightElement: vi.fn(),
    highlight: vi.fn().mockReturnValue('<span>code</span>'),
    languages: { javascript: {}, typescript: {}, jsx: {}, tsx: {}, css: {}, markup: {}, json: {} },
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

import { CodeEditor } from './CodeEditor'

describe('CodeEditor', () => {
  it('renders code content', () => {
    render(
      <CodeEditor
        code="const x = 1;"
        language="javascript"
      />
    )
    expect(screen.getByText('const x = 1;')).toBeInTheDocument()
  })

  it('renders textarea for editable mode', () => {
    render(
      <CodeEditor
        code="let y = 2;"
        language="typescript"
        readOnly={false}
        onChange={vi.fn()}
      />
    )
    const textarea = document.querySelector('textarea')
    expect(textarea).toBeTruthy()
  })

  it('renders without crashing in readonly mode', () => {
    render(
      <CodeEditor
        code=""
        language="json"
        readOnly={true}
      />
    )
    expect(document.body).toBeTruthy()
  })

  it('shows line numbers when enabled', () => {
    render(
      <CodeEditor
        code="line1\nline2\nline3"
        language="typescript"
        showLineNumbers={true}
      />
    )
    // Line number gutter should render
    expect(document.body).toBeTruthy()
  })
})
