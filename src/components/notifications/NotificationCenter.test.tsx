import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { NotificationCenter } from './NotificationCenter'
import type { Notification } from '@/lib/types'

const makeNotification = (overrides: Partial<Notification> = {}): Notification => ({
  id: 'n1',
  type: 'info',
  title: 'Test notification',
  message: 'Something happened',
  timestamp: new Date('2025-01-01T12:00:00Z').getTime(),
  read: false,
  ...overrides,
})

describe('NotificationCenter', () => {
  it('renders empty state when no notifications', () => {
    render(
      <NotificationCenter notifications={[]} onMarkAsRead={vi.fn()} onClear={vi.fn()} />
    )
    expect(screen.getByText('No notifications')).toBeInTheDocument()
  })

  it('hides Clear All button when list is empty', () => {
    render(
      <NotificationCenter notifications={[]} onMarkAsRead={vi.fn()} onClear={vi.fn()} />
    )
    expect(screen.queryByRole('button', { name: /clear all/i })).not.toBeInTheDocument()
  })

  it('shows Clear All button when there are notifications', () => {
    const notifications = [makeNotification()]
    render(
      <NotificationCenter notifications={notifications} onMarkAsRead={vi.fn()} onClear={vi.fn()} />
    )
    expect(screen.getByRole('button', { name: /clear all/i })).toBeInTheDocument()
  })

  it('shows unread badge with correct count', () => {
    const notifications = [
      makeNotification({ id: 'n1', read: false }),
      makeNotification({ id: 'n2', read: false }),
      makeNotification({ id: 'n3', read: true }),
    ]
    render(
      <NotificationCenter notifications={notifications} onMarkAsRead={vi.fn()} onClear={vi.fn()} />
    )
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('does not show unread badge when all are read', () => {
    const notifications = [
      makeNotification({ id: 'n1', read: true }),
    ]
    render(
      <NotificationCenter notifications={notifications} onMarkAsRead={vi.fn()} onClear={vi.fn()} />
    )
    // Title + message should render, badge with count should not
    expect(screen.queryByText('1')).not.toBeInTheDocument()
  })

  it('calls onMarkAsRead with id when notification is clicked', () => {
    const onMarkAsRead = vi.fn()
    const notification = makeNotification({ id: 'abc', title: 'Click me' })
    render(
      <NotificationCenter notifications={[notification]} onMarkAsRead={onMarkAsRead} onClear={vi.fn()} />
    )
    fireEvent.click(screen.getByText('Click me'))
    expect(onMarkAsRead).toHaveBeenCalledWith('abc')
  })

  it('calls onClear when Clear All is clicked', () => {
    const onClear = vi.fn()
    const notifications = [makeNotification()]
    render(
      <NotificationCenter notifications={notifications} onMarkAsRead={vi.fn()} onClear={onClear} />
    )
    fireEvent.click(screen.getByRole('button', { name: /clear all/i }))
    expect(onClear).toHaveBeenCalledOnce()
  })

  it('renders notification title and message', () => {
    const notification = makeNotification({ title: 'My Title', message: 'My message text' })
    render(
      <NotificationCenter notifications={[notification]} onMarkAsRead={vi.fn()} onClear={vi.fn()} />
    )
    expect(screen.getByText('My Title')).toBeInTheDocument()
    expect(screen.getByText('My message text')).toBeInTheDocument()
  })

  it('renders all four notification types without crashing', () => {
    const types: Notification['type'][] = ['agent_complete', 'agent_error', 'schedule_run', 'info']
    const notifications = types.map((type, i) =>
      makeNotification({ id: `n${i}`, type, title: `${type} title` })
    )
    render(
      <NotificationCenter notifications={notifications} onMarkAsRead={vi.fn()} onClear={vi.fn()} />
    )
    types.forEach(type => {
      expect(screen.getByText(`${type} title`)).toBeInTheDocument()
    })
  })

  it('renders multiple notifications', () => {
    const notifications = [
      makeNotification({ id: 'n1', title: 'First' }),
      makeNotification({ id: 'n2', title: 'Second' }),
      makeNotification({ id: 'n3', title: 'Third' }),
    ]
    render(
      <NotificationCenter notifications={notifications} onMarkAsRead={vi.fn()} onClear={vi.fn()} />
    )
    expect(screen.getByText('First')).toBeInTheDocument()
    expect(screen.getByText('Second')).toBeInTheDocument()
    expect(screen.getByText('Third')).toBeInTheDocument()
  })
})
