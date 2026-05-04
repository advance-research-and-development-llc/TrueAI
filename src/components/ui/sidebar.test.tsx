// Comprehensive tests for the vendored shadcn `sidebar.tsx` primitive. Unlike
// the thin Radix wrappers covered in `shadcn-primitives.test.tsx`, sidebar
// contains substantial application logic — controlled/uncontrolled state,
// cookie persistence, a Ctrl+B keyboard shortcut, a mobile/desktop branch,
// and a `useSidebar` context guard — so each branch gets an explicit
// assertion here rather than a single smoke render. This file took
// `src/components/ui/sidebar.tsx` from 0% to ~100% line coverage.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from './sidebar'

// Shared helper to set the matchMedia mock so we can flip between desktop
// (default: matches=false) and mobile (matches=true) per test. The base mock
// is installed in `src/test/setup.ts`; we restore it after each test.
const originalMatchMedia = window.matchMedia
function setMobile(isMobile: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: isMobile,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
  // useIsMobile reads window.innerWidth as well — keep it consistent.
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: isMobile ? 400 : 1280,
  })
}

const originalCookieDescriptor = Object.getOwnPropertyDescriptor(
  Document.prototype,
  'cookie',
)

describe('sidebar primitive', () => {
  beforeEach(() => {
    setMobile(false)
  })

  afterEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: originalMatchMedia,
    })
    if (originalCookieDescriptor) {
      Object.defineProperty(Document.prototype, 'cookie', originalCookieDescriptor)
    }
    // Wipe any cookies we may have set during a test.
    document.cookie
      .split(';')
      .map(c => c.split('=')[0]?.trim())
      .filter(Boolean)
      .forEach(name => {
        document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`
      })
  })

  describe('useSidebar guard', () => {
    function NakedConsumer() {
      useSidebar()
      return null
    }

    it('throws a helpful error when used outside SidebarProvider', () => {
      // React 19 logs the boundary error to console; silence to keep CI clean.
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      expect(() => render(<NakedConsumer />)).toThrow(
        /useSidebar must be used within a SidebarProvider/,
      )
      errorSpy.mockRestore()
    })
  })

  describe('SidebarProvider', () => {
    it('renders children inside a wrapper with sidebar CSS variables', () => {
      render(
        <SidebarProvider data-testid="provider" style={{ color: 'red' }}>
          <span data-testid="child">child</span>
        </SidebarProvider>,
      )
      const wrapper = screen.getByTestId('provider')
      expect(wrapper).toHaveAttribute('data-slot', 'sidebar-wrapper')
      // Style merges sidebar variables with caller style.
      expect(wrapper.style.getPropertyValue('--sidebar-width')).toBe('16rem')
      expect(wrapper.style.getPropertyValue('--sidebar-width-icon')).toBe('3rem')
      expect(wrapper.style.color).toBe('red')
      expect(screen.getByTestId('child')).toBeInTheDocument()
    })

    it('writes the open state to a cookie when toggled (uncontrolled)', () => {
      // Capture every cookie write so we don't depend on jsdom's
      // semicolon-joined readback semantics.
      const writes: string[] = []
      Object.defineProperty(Document.prototype, 'cookie', {
        configurable: true,
        get: () => writes.join('; '),
        set: (v: string) => {
          writes.push(v)
        },
      })
      render(
        <SidebarProvider defaultOpen>
          <SidebarTrigger />
        </SidebarProvider>,
      )
      fireEvent.click(screen.getByRole('button', { name: /toggle sidebar/i }))
      expect(writes.some(w => w.startsWith('sidebar_state=false'))).toBe(true)
    })

    it('honors the controlled open prop and forwards changes to onOpenChange', () => {
      const onOpenChange = vi.fn()
      function Harness() {
        const [open, setOpen] = React.useState(true)
        return (
          <SidebarProvider
            open={open}
            onOpenChange={(v) => {
              onOpenChange(v)
              setOpen(v)
            }}
          >
            <Sidebar data-testid="sb">
              <SidebarHeader>hdr</SidebarHeader>
            </Sidebar>
            <SidebarTrigger />
          </SidebarProvider>
        )
      }
      const { container } = render(<Harness />)
      // Before any toggle: data-state on the desktop sidebar is "expanded".
      const sb = container.querySelector('[data-slot="sidebar"]')
      expect(sb).toHaveAttribute('data-state', 'expanded')
      fireEvent.click(screen.getByRole('button', { name: /toggle sidebar/i }))
      expect(onOpenChange).toHaveBeenCalledWith(false)
      // And the controlled state should have flipped the data-state.
      expect(
        container.querySelector('[data-slot="sidebar"]'),
      ).toHaveAttribute('data-state', 'collapsed')
    })

    it('toggles via the Ctrl+B / Meta+B keyboard shortcut and unsubscribes on unmount', () => {
      const removeSpy = vi.spyOn(window, 'removeEventListener')
      const onOpenChange = vi.fn()
      const { unmount } = render(
        <SidebarProvider open onOpenChange={onOpenChange}>
          <Sidebar />
        </SidebarProvider>,
      )
      const event = new KeyboardEvent('keydown', {
        key: 'b',
        ctrlKey: true,
        cancelable: true,
      })
      window.dispatchEvent(event)
      // preventDefault was called by the handler.
      expect(event.defaultPrevented).toBe(true)
      expect(onOpenChange).toHaveBeenCalledWith(false)

      // Non-shortcut keys are ignored — no extra calls.
      onOpenChange.mockClear()
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', ctrlKey: true }))
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b' })) // no modifier
      expect(onOpenChange).not.toHaveBeenCalled()

      // Meta key path also fires.
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', metaKey: true }))
      expect(onOpenChange).toHaveBeenCalledTimes(1)

      unmount()
      // We don't care about every removeEventListener call, only that one of
      // them is the keydown handler we attached.
      expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function))
      removeSpy.mockRestore()
    })
  })

  describe('Sidebar variants', () => {
    it('renders the static container when collapsible="none"', () => {
      const { container } = render(
        <SidebarProvider>
          <Sidebar collapsible="none" className="custom-cls" data-testid="sb">
            <span>inside</span>
          </Sidebar>
        </SidebarProvider>,
      )
      const sb = container.querySelector('[data-slot="sidebar"]')!
      expect(sb).toHaveClass('custom-cls')
      // The collapsible=none branch does NOT add data-state/data-side wrapper
      // — it's a flat div.
      expect(sb).not.toHaveAttribute('data-state')
      expect(sb).toHaveTextContent('inside')
    })

    it('renders a Sheet (mobile portal) when isMobile=true', async () => {
      setMobile(true)
      render(
        <SidebarProvider>
          <Sidebar>
            <SidebarHeader>mobile-header</SidebarHeader>
          </Sidebar>
          <SidebarTrigger />
        </SidebarProvider>,
      )
      // Open the mobile sheet by clicking the trigger.
      fireEvent.click(screen.getByRole('button', { name: /toggle sidebar/i }))
      // The mobile sheet renders into a portal under document.body.
      const mobileContent = document.body.querySelector('[data-mobile="true"]')
      expect(mobileContent).not.toBeNull()
      expect(mobileContent).toHaveAttribute('data-slot', 'sidebar')
      expect(
        document.body.querySelector('[data-slot="sidebar-header"]'),
      ).toHaveTextContent('mobile-header')
    })

    it.each([
      ['left', 'sidebar', 'offcanvas'] as const,
      ['right', 'floating', 'icon'] as const,
      ['left', 'inset', 'offcanvas'] as const,
    ])('renders desktop variant side=%s variant=%s collapsible=%s', (side, variant, collapsible) => {
      const { container } = render(
        <SidebarProvider defaultOpen={false}>
          <Sidebar side={side} variant={variant} collapsible={collapsible} />
        </SidebarProvider>,
      )
      const sb = container.querySelector('[data-slot="sidebar"]')!
      expect(sb).toHaveAttribute('data-side', side)
      expect(sb).toHaveAttribute('data-variant', variant)
      // collapsed defaultOpen=false → data-collapsible reflects the prop.
      expect(sb).toHaveAttribute('data-collapsible', collapsible)
      expect(sb).toHaveAttribute('data-state', 'collapsed')
      // gap + container + inner sub-divs all rendered.
      expect(container.querySelector('[data-slot="sidebar-gap"]')).not.toBeNull()
      expect(container.querySelector('[data-slot="sidebar-container"]')).not.toBeNull()
      expect(container.querySelector('[data-slot="sidebar-inner"]')).not.toBeNull()
    })

    it('clears data-collapsible while expanded', () => {
      const { container } = render(
        <SidebarProvider defaultOpen>
          <Sidebar collapsible="icon" />
        </SidebarProvider>,
      )
      const sb = container.querySelector('[data-slot="sidebar"]')!
      expect(sb).toHaveAttribute('data-state', 'expanded')
      expect(sb).toHaveAttribute('data-collapsible', '')
    })
  })

  describe('SidebarTrigger and SidebarRail', () => {
    it('SidebarTrigger calls user onClick *and* toggles the sidebar', () => {
      const onClick = vi.fn()
      const onOpenChange = vi.fn()
      render(
        <SidebarProvider open onOpenChange={onOpenChange}>
          <SidebarTrigger onClick={onClick} />
        </SidebarProvider>,
      )
      fireEvent.click(screen.getByRole('button', { name: /toggle sidebar/i }))
      expect(onClick).toHaveBeenCalledTimes(1)
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })

    it('SidebarRail toggles on click and exposes its aria-label', () => {
      const onOpenChange = vi.fn()
      render(
        <SidebarProvider open onOpenChange={onOpenChange}>
          <SidebarRail data-testid="rail" />
        </SidebarProvider>,
      )
      const rail = screen.getByTestId('rail')
      expect(rail).toHaveAttribute('aria-label', 'Toggle Sidebar')
      expect(rail).toHaveAttribute('data-slot', 'sidebar-rail')
      fireEvent.click(rail)
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })
  })

  describe('layout & content sub-components', () => {
    function Wrapper({ children }: { children: React.ReactNode }) {
      return <SidebarProvider>{children}</SidebarProvider>
    }

    it('renders all simple slot wrappers with their data-slot attribute', () => {
      const { container } = render(
        <Wrapper>
          <SidebarInset data-testid="inset" />
          <SidebarInput placeholder="search" />
          <SidebarHeader>hdr</SidebarHeader>
          <SidebarFooter>ftr</SidebarFooter>
          <SidebarSeparator />
          <SidebarContent>content</SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>gc</SidebarGroupContent>
          </SidebarGroup>
        </Wrapper>,
      )
      // Inset is a <main>.
      const inset = screen.getByTestId('inset')
      expect(inset.tagName).toBe('MAIN')
      expect(inset).toHaveAttribute('data-slot', 'sidebar-inset')

      expect(
        container.querySelector('[data-slot="sidebar-input"]'),
      ).toBeInTheDocument()
      expect(
        container.querySelector('[data-slot="sidebar-header"]'),
      ).toHaveTextContent('hdr')
      expect(
        container.querySelector('[data-slot="sidebar-footer"]'),
      ).toHaveTextContent('ftr')
      expect(
        container.querySelector('[data-slot="sidebar-separator"]'),
      ).toBeInTheDocument()
      expect(
        container.querySelector('[data-slot="sidebar-content"]'),
      ).toHaveTextContent('content')
      expect(
        container.querySelector('[data-slot="sidebar-group"]'),
      ).toBeInTheDocument()
      expect(
        container.querySelector('[data-slot="sidebar-group-content"]'),
      ).toHaveTextContent('gc')
    })

    it('SidebarGroupLabel respects asChild=false (div) and asChild=true (Slot)', () => {
      const { container, rerender } = render(
        <Wrapper>
          <SidebarGroupLabel>plain</SidebarGroupLabel>
        </Wrapper>,
      )
      let label = container.querySelector('[data-slot="sidebar-group-label"]')!
      expect(label.tagName).toBe('DIV')
      expect(label).toHaveTextContent('plain')

      rerender(
        <Wrapper>
          <SidebarGroupLabel asChild>
            <h2>heading</h2>
          </SidebarGroupLabel>
        </Wrapper>,
      )
      label = container.querySelector('[data-slot="sidebar-group-label"]')!
      expect(label.tagName).toBe('H2')
      expect(label).toHaveTextContent('heading')
    })

    it('SidebarGroupAction respects asChild and forwards onClick', () => {
      const onClick = vi.fn()
      const { container, rerender } = render(
        <Wrapper>
          <SidebarGroupAction onClick={onClick}>+</SidebarGroupAction>
        </Wrapper>,
      )
      const btn = container.querySelector('[data-slot="sidebar-group-action"]')!
      expect(btn.tagName).toBe('BUTTON')
      fireEvent.click(btn)
      expect(onClick).toHaveBeenCalled()

      rerender(
        <Wrapper>
          <SidebarGroupAction asChild>
            <a href="#x">link</a>
          </SidebarGroupAction>
        </Wrapper>,
      )
      const slotted = container.querySelector('[data-slot="sidebar-group-action"]')!
      expect(slotted.tagName).toBe('A')
    })
  })

  describe('Menu sub-components', () => {
    function Wrapper({ children }: { children: React.ReactNode }) {
      return <SidebarProvider>{children}</SidebarProvider>
    }

    it('renders Menu/Item/Sub/SubItem with the right tags and data-slots', () => {
      const { container } = render(
        <Wrapper>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuSub>
                <SidebarMenuSubItem>
                  <SidebarMenuSubButton>sub</SidebarMenuSubButton>
                </SidebarMenuSubItem>
              </SidebarMenuSub>
            </SidebarMenuItem>
          </SidebarMenu>
        </Wrapper>,
      )
      expect(container.querySelector('ul[data-slot="sidebar-menu"]')).not.toBeNull()
      expect(container.querySelector('li[data-slot="sidebar-menu-item"]')).not.toBeNull()
      expect(container.querySelector('ul[data-slot="sidebar-menu-sub"]')).not.toBeNull()
      expect(container.querySelector('li[data-slot="sidebar-menu-sub-item"]')).not.toBeNull()
      const subBtn = container.querySelector('[data-slot="sidebar-menu-sub-button"]')!
      expect(subBtn.tagName).toBe('A')
      expect(subBtn).toHaveAttribute('data-size', 'md')
      expect(subBtn).toHaveAttribute('data-active', 'false')
    })

    it('SidebarMenuSubButton honors size="sm", isActive=true, and asChild', () => {
      const { container } = render(
        <Wrapper>
          <SidebarMenuSubButton size="sm" isActive asChild>
            <button type="button">slotted</button>
          </SidebarMenuSubButton>
        </Wrapper>,
      )
      const el = container.querySelector('[data-slot="sidebar-menu-sub-button"]')!
      expect(el.tagName).toBe('BUTTON')
      expect(el).toHaveAttribute('data-size', 'sm')
      expect(el).toHaveAttribute('data-active', 'true')
    })

    it('SidebarMenuButton — no-tooltip branch returns the button directly', () => {
      const { container } = render(
        <Wrapper>
          <SidebarMenuButton>plain</SidebarMenuButton>
        </Wrapper>,
      )
      const btn = container.querySelector('[data-slot="sidebar-menu-button"]')!
      expect(btn.tagName).toBe('BUTTON')
      expect(btn).toHaveAttribute('data-active', 'false')
      expect(btn).toHaveAttribute('data-size', 'default')
      // No tooltip wrapper rendered.
      expect(document.body.querySelector('[role="tooltip"]')).toBeNull()
    })

    it('SidebarMenuButton — string tooltip renders a Radix tooltip wrapper', async () => {
      // Tooltip content is portaled and only shown on focus/hover with the
      // correct delay; for coverage we only need to assert the wrapper is in
      // the tree (the trigger element gains a `data-state` attribute when
      // wrapped). Hovering further would require timers — the wrapper render
      // alone exercises the string-tooltip branch.
      render(
        <Wrapper>
          <SidebarMenuButton tooltip="hello">trigger</SidebarMenuButton>
        </Wrapper>,
      )
      const btn = screen.getByText('trigger')
      // Radix Tooltip.Trigger asChild merges data-state onto the inner button.
      expect(btn).toHaveAttribute('data-state')
    })

    it('SidebarMenuButton — object tooltip with explicit children also works', () => {
      render(
        <Wrapper>
          <SidebarMenuButton
            isActive
            variant="outline"
            size="lg"
            tooltip={{ children: <span>obj</span>, side: 'right' }}
          >
            trigger
          </SidebarMenuButton>
        </Wrapper>,
      )
      const btn = screen.getByText('trigger')
      expect(btn).toHaveAttribute('data-active', 'true')
      expect(btn).toHaveAttribute('data-size', 'lg')
    })

    it('SidebarMenuButton — asChild forwards to the provided element', () => {
      const { container } = render(
        <Wrapper>
          <SidebarMenuButton asChild>
            <a href="#nav">linked</a>
          </SidebarMenuButton>
        </Wrapper>,
      )
      const el = container.querySelector('[data-slot="sidebar-menu-button"]')!
      expect(el.tagName).toBe('A')
      expect(el).toHaveAttribute('href', '#nav')
    })

    it('SidebarMenuAction renders, supports showOnHover and asChild', () => {
      const { container, rerender } = render(
        <Wrapper>
          <SidebarMenuAction>+</SidebarMenuAction>
        </Wrapper>,
      )
      let el = container.querySelector('[data-slot="sidebar-menu-action"]')!
      expect(el.tagName).toBe('BUTTON')

      rerender(
        <Wrapper>
          <SidebarMenuAction showOnHover asChild>
            <a href="#a">act</a>
          </SidebarMenuAction>
        </Wrapper>,
      )
      el = container.querySelector('[data-slot="sidebar-menu-action"]')!
      expect(el.tagName).toBe('A')
      // showOnHover branch concatenates an extra class string.
      expect(el.className).toContain('opacity-0')
    })

    it('SidebarMenuBadge renders with correct slot', () => {
      const { container } = render(
        <Wrapper>
          <SidebarMenuBadge>9</SidebarMenuBadge>
        </Wrapper>,
      )
      const el = container.querySelector('[data-slot="sidebar-menu-badge"]')!
      expect(el).toHaveTextContent('9')
    })

    it('SidebarMenuSkeleton renders with and without an icon and sets a CSS skeleton-width', () => {
      // Make Math.random deterministic so the snapshot of the inline style
      // doesn't flake.
      const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5)
      const { container, rerender } = render(
        <Wrapper>
          <SidebarMenuSkeleton />
        </Wrapper>,
      )
      let skel = container.querySelector('[data-slot="sidebar-menu-skeleton"]')!
      // showIcon=false → no icon child.
      expect(skel.querySelector('[data-sidebar="menu-skeleton-icon"]')).toBeNull()
      const text = skel.querySelector('[data-sidebar="menu-skeleton-text"]') as HTMLElement
      // 0.5 * 40 + 50 = 70 → "70%"
      expect(text.style.getPropertyValue('--skeleton-width')).toBe('70%')

      rerender(
        <Wrapper>
          <SidebarMenuSkeleton showIcon />
        </Wrapper>,
      )
      skel = container.querySelector('[data-slot="sidebar-menu-skeleton"]')!
      expect(skel.querySelector('[data-sidebar="menu-skeleton-icon"]')).not.toBeNull()
      randomSpy.mockRestore()
    })
  })

  describe('controlled provider with functional setOpen via Ctrl+B', () => {
    // Covers the `typeof value === "function"` branch of setOpen — the
    // toggleSidebar callback always passes a function updater on desktop.
    it('flips state when Ctrl+B is pressed in uncontrolled mode', () => {
      const { container } = render(
        <SidebarProvider defaultOpen>
          <Sidebar />
        </SidebarProvider>,
      )
      const sb = () => container.querySelector('[data-slot="sidebar"]')!
      expect(sb()).toHaveAttribute('data-state', 'expanded')
      act(() => {
        window.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'b', ctrlKey: true }),
        )
      })
      expect(sb()).toHaveAttribute('data-state', 'collapsed')
      act(() => {
        window.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'b', ctrlKey: true }),
        )
      })
      expect(sb()).toHaveAttribute('data-state', 'expanded')
    })

    it('toggleSidebar on mobile flips openMobile (sheet visibility)', () => {
      setMobile(true)
      render(
        <SidebarProvider>
          <Sidebar>
            <SidebarHeader>m</SidebarHeader>
          </Sidebar>
          <SidebarTrigger />
        </SidebarProvider>,
      )
      // Sheet is closed initially: no data-mobile container in the DOM.
      expect(document.body.querySelector('[data-mobile="true"]')).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: /toggle sidebar/i }))
      const sheet = document.body.querySelector('[data-mobile="true"]')
      expect(sheet).not.toBeNull()
      expect(sheet).toHaveAttribute('data-state', 'open')
      // Closing via Radix Sheet's own Close button exercises the
      // setOpenMobile(false) callback path.
      const closeBtn = screen.getByRole('button', { name: /^close$/i })
      fireEvent.click(closeBtn)
      // Sheet may stay in the DOM with data-state="closed" while its exit
      // animation runs; that's enough to confirm the close handler fired.
      const after = document.body.querySelector('[data-mobile="true"]')
      if (after) {
        expect(after.getAttribute('data-state')).toBe('closed')
      }
    })
  })
})
