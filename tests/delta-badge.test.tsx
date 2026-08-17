/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DeltaBadge } from '@/components/dashboard/delta-badge'
import type { Delta } from '@/lib/metrics'

const delta = (over: Partial<Delta> = {}): Delta => ({
  current: 10,
  previous: 5,
  percent: 100,
  direction: 'up',
  ...over,
})

describe('DeltaBadge', () => {
  it('shows a signed percentage', () => {
    render(<DeltaBadge delta={delta()} />)
    expect(screen.getByText('+100%')).toBeInTheDocument()
  })

  it('renders nothing when both periods are empty', () => {
    // A badge on a metric this person does not track is pure noise.
    const { container } = render(
      <DeltaBadge delta={delta({ current: 0, previous: 0, percent: null, direction: 'flat' })} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('says "new" rather than a percentage when growing from zero', () => {
    render(<DeltaBadge delta={delta({ current: 7, previous: 0, percent: null })} />)
    expect(screen.getByText('new')).toBeInTheDocument()
  })

  it('does not colour a decline as an error', () => {
    // A dip in a month where less was published is not a failure, and red
    // starts the conversation this dashboard exists to avoid.
    render(
      <DeltaBadge delta={delta({ current: 4, previous: 8, percent: -50, direction: 'down' })} />,
    )
    const badge = screen.getByText('-50%').closest('span')
    expect(badge?.className).not.toMatch(/destructive|text-red/)
    expect(badge?.className).toMatch(/muted-foreground/)
  })

  it('exposes both raw numbers for anyone who wants the detail', () => {
    render(<DeltaBadge delta={delta({ current: 1234, previous: 1000, percent: 23 })} />)
    const badge = screen.getByText('+23%').closest('span')
    expect(badge?.getAttribute('title')).toContain('1,234')
    expect(badge?.getAttribute('title')).toContain('1,000')
  })
})
