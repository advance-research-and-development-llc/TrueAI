import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { AppBuilder } from './AppBuilder'

describe('AppBuilder', () => {
  it('renders heading', () => {
    render(<AppBuilder models={[]} />)
    expect(screen.getByText(/app builder/i)).toBeInTheDocument()
  })

  it('renders New Project button or CTA', () => {
    render(<AppBuilder models={[]} />)
    expect(screen.getByRole('button', { name: /new project/i })).toBeInTheDocument()
  })

  it('renders without crashing', () => {
    render(<AppBuilder models={[]} />)
    expect(document.body).toBeTruthy()
  })
})
