import { describe, it, expect, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { MetricCard } from './MetricCard'

describe('MetricCard', () => {
  it('renders title', () => {
    render(<MetricCard title="Total Requests" value="42" icon={<span>icon</span>} />)
    expect(screen.getByText('Total Requests')).toBeInTheDocument()
  })

  it('renders value', () => {
    render(<MetricCard title="Title" value="99" icon={<span>icon</span>} />)
    expect(screen.getByText('99')).toBeInTheDocument()
  })

  it('renders icon', () => {
    render(<MetricCard title="Title" value="0" icon={<span data-testid="my-icon">icon</span>} />)
    expect(screen.getByTestId('my-icon')).toBeInTheDocument()
  })

  it('does not show trend when trendValue not provided', () => {
    const { container } = render(<MetricCard title="T" value="1" icon={<span />} />)
    expect(container.querySelector('.text-green-500')).not.toBeInTheDocument()
    expect(container.querySelector('.text-red-500')).not.toBeInTheDocument()
  })

  it('up trend shows green arrow and value', () => {
    render(<MetricCard title="T" value="5" icon={<span />} trend="up" trendValue="+10%" />)
    expect(screen.getByText('+10%')).toBeInTheDocument()
    const el = screen.getByText('+10%')
    expect(el.className).toContain('green')
  })

  it('down trend shows red arrow and value', () => {
    render(<MetricCard title="T" value="5" icon={<span />} trend="down" trendValue="-5%" />)
    expect(screen.getByText('-5%')).toBeInTheDocument()
    const el = screen.getByText('-5%')
    expect(el.className).toContain('red')
  })

  it('neutral trend shows minus icon and value', () => {
    render(<MetricCard title="T" value="5" icon={<span />} trend="neutral" trendValue="0%" />)
    expect(screen.getByText('0%')).toBeInTheDocument()
    const el = screen.getByText('0%')
    expect(el.className).toContain('muted')
  })

  it('update pulse triggers on value change', async () => {
    const { rerender, container } = render(
      <MetricCard title="T" value="10" icon={<span />} />
    )
    expect(container.querySelector('.ring-2')).not.toBeInTheDocument()
    await act(async () => {
      rerender(<MetricCard title="T" value="20" icon={<span />} />)
    })
    expect(container.querySelector('.ring-2')).toBeInTheDocument()
  })

  it('numeric value rendered', () => {
    render(<MetricCard title="Count" value={42} icon={<span />} />)
    expect(screen.getByText('42')).toBeInTheDocument()
  })
})
