/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { useMemo, useState } from 'react'

/**
 * A regression guard for the bug that reached production: a `useMemo` placed
 * below an early `return`, so the first render ran one fewer hook than the
 * second and React threw the moment the profile loaded.
 *
 * eslint's rules-of-hooks now catches the pattern statically, which is the real
 * fix. This exists because that rule can be disabled with a comment, and because
 * the failure only appears when a value flips from falsy to truthy between
 * renders — the exact transition a component test can force and a page rendered
 * once in a browser will not.
 */

/** The shape of the bug. */
function Broken({ ready }: { ready: boolean }) {
  const [count] = useState(0)
  if (!ready) return <p>loading</p>
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const doubled = useMemo(() => count * 2, [count])
  return <p>{doubled}</p>
}

/** The same component with the hook above the guard. */
function Fixed({ ready }: { ready: boolean }) {
  const [count] = useState(0)
  const doubled = useMemo(() => count * 2, [count])
  if (!ready) return <p>loading</p>
  return <p>{doubled}</p>
}

describe('hooks below an early return', () => {
  it('throws when the guard flips from false to true', () => {
    // React logs the error as well as throwing; silence it so the run stays
    // readable, and assert on the throw rather than on console noise.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { rerender } = render(<Broken ready={false} />)
    expect(() => rerender(<Broken ready />)).toThrow(/more hooks than during the previous/i)

    consoleError.mockRestore()
  })

  it('does not throw once the hook sits above the guard', () => {
    const { rerender, container } = render(<Fixed ready={false} />)
    expect(container.textContent).toBe('loading')

    expect(() => rerender(<Fixed ready />)).not.toThrow()
    expect(container.textContent).toBe('0')
  })
})
