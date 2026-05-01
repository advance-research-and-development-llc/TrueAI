// Smoke tests for thin shadcn/ui primitive wrappers that are otherwise unused
// in the app and therefore show 0% coverage. Each test renders the component
// and asserts on its data-slot or DOM tag so the wrapper code (className
// assembly via cn(), variant defaults, asChild forwarding) is exercised.

import { describe, it, expect } from 'vitest'
import * as React from 'react'
import { render, screen } from '@testing-library/react'
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from './accordion'
import { AspectRatio } from './aspect-ratio'
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
} from './breadcrumb'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from './collapsible'
import { Drawer, DrawerTrigger, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter, DrawerClose } from './drawer'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from './pagination'
import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
} from './table'
import { Toggle } from './toggle'
import { ToggleGroup, ToggleGroupItem } from './toggle-group'
import { HoverCard, HoverCardTrigger, HoverCardContent } from './hover-card'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from './resizable'
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from './input-otp'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from './dropdown-menu'
import { useForm } from 'react-hook-form'
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
} from './form'
import { Toaster } from './sonner'
import { Input } from './input'

describe('Accordion primitive', () => {
  it('renders accordion items with trigger and content', () => {
    render(
      <Accordion type="single" collapsible defaultValue="a">
        <AccordionItem value="a" data-testid="acc-item">
          <AccordionTrigger data-testid="acc-trigger">Trigger</AccordionTrigger>
          <AccordionContent>Body</AccordionContent>
        </AccordionItem>
      </Accordion>
    )
    expect(screen.getByTestId('acc-item')).toHaveAttribute('data-slot', 'accordion-item')
    expect(screen.getByTestId('acc-trigger')).toHaveAttribute('data-slot', 'accordion-trigger')
    expect(screen.getByText('Trigger')).toBeInTheDocument()
  })
})

describe('AspectRatio primitive', () => {
  it('renders the aspect-ratio wrapper', () => {
    render(<AspectRatio ratio={16 / 9} data-testid="ar"><div>Inside</div></AspectRatio>)
    expect(screen.getByTestId('ar')).toHaveAttribute('data-slot', 'aspect-ratio')
    expect(screen.getByText('Inside')).toBeInTheDocument()
  })
})

describe('Breadcrumb primitive', () => {
  it('renders all breadcrumb sub-components with correct ARIA roles', () => {
    render(
      <Breadcrumb data-testid="bc">
        <BreadcrumbList data-testid="bc-list">
          <BreadcrumbItem data-testid="bc-item">
            <BreadcrumbLink href="/" data-testid="bc-link">Home</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator data-testid="bc-sep" />
          <BreadcrumbItem>
            <BreadcrumbPage data-testid="bc-page">Current</BreadcrumbPage>
          </BreadcrumbItem>
          <BreadcrumbEllipsis data-testid="bc-ellipsis" />
        </BreadcrumbList>
      </Breadcrumb>
    )
    expect(screen.getByTestId('bc')).toHaveAttribute('aria-label', 'breadcrumb')
    expect(screen.getByTestId('bc-list')).toHaveAttribute('data-slot', 'breadcrumb-list')
    expect(screen.getByTestId('bc-link')).toHaveAttribute('href', '/')
    expect(screen.getByTestId('bc-page')).toHaveAttribute('aria-current', 'page')
    expect(screen.getByTestId('bc-sep')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByTestId('bc-ellipsis')).toHaveAttribute('aria-hidden', 'true')
  })

  it('forwards children through BreadcrumbLink with asChild', () => {
    render(
      <BreadcrumbLink asChild data-testid="bc-link-as">
        <span>SpanLink</span>
      </BreadcrumbLink>
    )
    expect(screen.getByTestId('bc-link-as').tagName).toBe('SPAN')
  })

  it('renders a custom child inside BreadcrumbSeparator', () => {
    render(<BreadcrumbSeparator data-testid="bc-sep-custom"><span>Custom</span></BreadcrumbSeparator>)
    expect(screen.getByText('Custom')).toBeInTheDocument()
  })
})

describe('Collapsible primitive', () => {
  it('renders Collapsible with Trigger and Content', () => {
    render(
      <Collapsible defaultOpen data-testid="col">
        <CollapsibleTrigger data-testid="col-trigger">Toggle</CollapsibleTrigger>
        <CollapsibleContent data-testid="col-content">Body</CollapsibleContent>
      </Collapsible>
    )
    expect(screen.getByTestId('col')).toHaveAttribute('data-slot', 'collapsible')
    expect(screen.getByTestId('col-trigger')).toHaveAttribute('data-slot', 'collapsible-trigger')
    expect(screen.getByText('Body')).toBeInTheDocument()
  })
})

describe('Drawer primitive', () => {
  it('renders an open Drawer with title, description, header, footer, and close', () => {
    render(
      <Drawer open>
        <DrawerTrigger>Open</DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Title</DrawerTitle>
            <DrawerDescription>Description</DrawerDescription>
          </DrawerHeader>
          <DrawerFooter>
            <DrawerClose>Close</DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    )
    expect(screen.getByText('Title')).toBeInTheDocument()
    expect(screen.getByText('Description')).toBeInTheDocument()
    expect(screen.getByText('Close')).toBeInTheDocument()
  })
})

describe('Pagination primitive', () => {
  it('renders pagination with previous, links, ellipsis, next', () => {
    render(
      <Pagination data-testid="pag">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious href="#" />
          </PaginationItem>
          <PaginationItem>
            <PaginationLink href="#" isActive>1</PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationLink href="#">2</PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationEllipsis />
          </PaginationItem>
          <PaginationItem>
            <PaginationNext href="#" />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    )
    expect(screen.getByTestId('pag')).toHaveAttribute('aria-label', 'pagination')
    expect(screen.getByText('1')).toHaveAttribute('aria-current', 'page')
    expect(screen.getByText('2')).toBeInTheDocument()
  })
})

describe('Table primitive', () => {
  it('renders a full table with header, body, footer, and caption', () => {
    render(
      <Table data-testid="tbl">
        <TableCaption>Cap</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Value</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>foo</TableCell>
            <TableCell>1</TableCell>
          </TableRow>
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell>Sum</TableCell>
            <TableCell>1</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    )
    expect(screen.getByTestId('tbl').tagName).toBe('TABLE')
    expect(screen.getByText('Name')).toBeInTheDocument()
    expect(screen.getByText('foo')).toBeInTheDocument()
    expect(screen.getByText('Cap')).toBeInTheDocument()
  })
})

describe('Toggle primitive', () => {
  it('renders default Toggle', () => {
    render(<Toggle data-testid="tg">B</Toggle>)
    expect(screen.getByTestId('tg')).toHaveAttribute('data-slot', 'toggle')
  })

  it('renders Toggle with outline variant and lg size', () => {
    render(<Toggle variant="outline" size="lg" data-testid="tg2">B</Toggle>)
    expect(screen.getByTestId('tg2')).toBeInTheDocument()
  })
})

describe('ToggleGroup primitive', () => {
  it('renders ToggleGroup with items', () => {
    render(
      <ToggleGroup type="single" defaultValue="a" data-testid="tg-grp">
        <ToggleGroupItem value="a">A</ToggleGroupItem>
        <ToggleGroupItem value="b">B</ToggleGroupItem>
      </ToggleGroup>
    )
    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByText('B')).toBeInTheDocument()
  })
})

describe('HoverCard primitive', () => {
  it('renders an open HoverCard with trigger and content', () => {
    render(
      <HoverCard open>
        <HoverCardTrigger data-testid="hc-trigger">Hover me</HoverCardTrigger>
        <HoverCardContent data-testid="hc-content" align="start" sideOffset={8}>
          Body content
        </HoverCardContent>
      </HoverCard>
    )
    expect(screen.getByTestId('hc-trigger')).toHaveAttribute(
      'data-slot',
      'hover-card-trigger'
    )
    // Content renders into a portal; query by text rather than testid container
    expect(screen.getByText('Body content')).toBeInTheDocument()
  })
})

describe('Resizable primitives', () => {
  it('renders a panel group with two panels and a handle (with grip)', () => {
    render(
      <ResizablePanelGroup direction="horizontal" data-testid="rpg">
        <ResizablePanel defaultSize={50} data-testid="rp1">Left</ResizablePanel>
        <ResizableHandle withHandle data-testid="rh" />
        <ResizablePanel defaultSize={50} data-testid="rp2">Right</ResizablePanel>
      </ResizablePanelGroup>
    )
    expect(screen.getByTestId('rpg')).toHaveAttribute(
      'data-slot',
      'resizable-panel-group'
    )
    expect(screen.getByTestId('rp1')).toHaveAttribute('data-slot', 'resizable-panel')
    expect(screen.getByTestId('rh')).toHaveAttribute('data-slot', 'resizable-handle')
    expect(screen.getByText('Left')).toBeInTheDocument()
    expect(screen.getByText('Right')).toBeInTheDocument()
  })

  it('renders a handle without grip when withHandle is omitted', () => {
    render(
      <ResizablePanelGroup direction="vertical">
        <ResizablePanel defaultSize={50}>A</ResizablePanel>
        <ResizableHandle data-testid="rh-bare" />
        <ResizablePanel defaultSize={50}>B</ResizablePanel>
      </ResizablePanelGroup>
    )
    expect(screen.getByTestId('rh-bare')).toBeInTheDocument()
  })
})

describe('InputOTP primitive', () => {
  it('renders OTP input with grouped slots and a separator', () => {
    render(
      <InputOTP maxLength={6} data-testid="otp">
        <InputOTPGroup data-testid="otp-grp">
          <InputOTPSlot index={0} data-testid="otp-slot-0" />
          <InputOTPSlot index={1} />
        </InputOTPGroup>
        <InputOTPSeparator data-testid="otp-sep" />
        <InputOTPGroup>
          <InputOTPSlot index={2} />
        </InputOTPGroup>
      </InputOTP>
    )
    expect(screen.getByTestId('otp-grp')).toHaveAttribute(
      'data-slot',
      'input-otp-group'
    )
    expect(screen.getByTestId('otp-slot-0')).toHaveAttribute(
      'data-slot',
      'input-otp-slot'
    )
    expect(screen.getByTestId('otp-sep')).toHaveAttribute('role', 'separator')
  })
})

describe('DropdownMenu primitive', () => {
  it('renders an open menu with label, items, separator, shortcut, and a checkbox/radio group', () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger data-testid="dm-trigger">Open</DropdownMenuTrigger>
        <DropdownMenuContent sideOffset={6}>
          <DropdownMenuLabel inset>Section</DropdownMenuLabel>
          <DropdownMenuGroup>
            <DropdownMenuItem inset>
              Item one
              <DropdownMenuShortcut>⌘A</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive">Delete</DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem checked>Check me</DropdownMenuCheckboxItem>
          <DropdownMenuRadioGroup value="r1">
            <DropdownMenuRadioItem value="r1">Radio one</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="r2">Radio two</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    )
    expect(screen.getByTestId('dm-trigger')).toHaveAttribute(
      'data-slot',
      'dropdown-menu-trigger'
    )
    expect(screen.getByText('Section')).toBeInTheDocument()
    expect(screen.getByText('Item one')).toBeInTheDocument()
    expect(screen.getByText('⌘A')).toBeInTheDocument()
    expect(screen.getByText('Delete')).toBeInTheDocument()
    expect(screen.getByText('Check me')).toBeInTheDocument()
    expect(screen.getByText('Radio one')).toBeInTheDocument()
    expect(screen.getByText('Radio two')).toBeInTheDocument()
  })
})

function FormHarness({
  withError = false,
  description = 'Helper text',
}: {
  withError?: boolean
  description?: string
}) {
  const form = useForm<{ username: string }>({
    defaultValues: { username: '' },
  })
  // Manually set an error after mount so FormMessage renders the error string
  // rather than children. Using useEffect avoids triggering a setState during
  // render of a sibling component (FormLabel).
  React.useEffect(() => {
    if (withError) {
      form.setError('username', { type: 'manual', message: 'Required field' })
    }
  }, [withError, form])
  return (
    <Form {...form}>
      <form>
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Username</FormLabel>
              <FormControl>
                <Input data-testid="username-input" {...field} />
              </FormControl>
              <FormDescription>{description}</FormDescription>
              <FormMessage>fallback</FormMessage>
            </FormItem>
          )}
        />
      </form>
    </Form>
  )
}

describe('Form primitive', () => {
  it('wires FormField → FormItem → FormLabel/FormControl/FormDescription with stable ids', () => {
    render(<FormHarness />)
    const label = screen.getByText('Username')
    const input = screen.getByTestId('username-input')
    const description = screen.getByText('Helper text')

    // Label is associated with the input via htmlFor → form-item id
    expect(label).toHaveAttribute('for', input.getAttribute('id') ?? '')
    expect(input).toHaveAttribute('aria-describedby', description.getAttribute('id') ?? '')
    expect(input).toHaveAttribute('aria-invalid', 'false')
    // FormMessage renders its children when there is no error
    expect(screen.getByText('fallback')).toBeInTheDocument()
  })

  it('renders FormMessage with the field error message and toggles aria-invalid', () => {
    render(<FormHarness withError />)
    const input = screen.getByTestId('username-input')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('Required field')).toBeInTheDocument()
  })
})

describe('Sonner Toaster primitive', () => {
  it('renders without crashing using next-themes default theme', () => {
    const { container } = render(<Toaster />)
    // Sonner renders a section with class containing 'toaster'
    const section = container.querySelector('section')
    expect(section).toBeTruthy()
  })
})
