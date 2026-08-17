/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MonthContribution } from '@/components/dashboard/month-contribution'
import type { Delta } from '@/lib/metrics'

const delta = (over: Partial<Delta> = {}): Delta => ({
  current: 12480,
  previous: 5000,
  percent: 150,
  direction: 'up',
  ...over,
})

describe('MonthContribution', () => {
  it('states what the month added, in absolute terms', () => {
    const { container } = render(<MonthContribution delta={delta()} month="2026-08" />)
    expect(screen.getByText('+12,480')).toBeInTheDocument()
    expect(container.textContent).toBe('+12,480 in August')
  })

  it('never shows a percentage against an all-time total', () => {
    // "247,520 downloads, -100%" read as the lifetime total collapsing, when it
    // meant nothing was published in that category last month. A percentage of a
    // cumulative figure is not a meaningful quantity.
    const { container } = render(
      <MonthContribution
        delta={delta({ current: 0, previous: 4000, percent: -100, direction: 'down' })}
        month="2026-08"
      />,
    )
    expect(container.textContent).not.toMatch(/%/)
    expect(container.textContent).toMatch(/none in August/)
  })

  it('renders nothing when the metric has never had a value', () => {
    const { container } = render(
      <MonthContribution
        delta={delta({ current: 0, previous: 0, percent: null, direction: 'flat' })}
        month="2026-08"
      />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('drops the year, which is already implied by the dashboard', () => {
    const { container } = render(<MonthContribution delta={delta()} month="2026-08" />)
    expect(container.textContent).not.toMatch(/2026/)
  })

  it('is its own block, so a long number cannot push it out of the card', () => {
    // The previous inline badge was clipped mid-word at six columns.
    const { container } = render(
      <MonthContribution delta={delta({ current: 247520 })} month="2026-08" />,
    )
    expect(container.firstElementChild?.tagName).toBe('P')
  })
})
