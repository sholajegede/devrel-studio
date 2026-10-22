'use client'

import { useEffect } from 'react'

/**
 * Last resort: catches errors thrown by the root layout itself, where app/error
 * cannot help because the layout that would wrap it is the thing that failed.
 *
 * This replaces the entire document, so it has to render its own <html> and
 * <body> — and it cannot rely on the app's CSS variables, providers, or
 * components, since none of them are guaranteed to have mounted. Hence the
 * inline styles and the hand-written media query for dark mode.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[app] root layout error:', error)
  }, [error])

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
          background: '#f8f0e3',
          color: '#180102',
        }}
      >
        <div
          className="panel"
          style={{
            maxWidth: '28rem',
            width: '100%',
            textAlign: 'center',
            background: '#ece4d7',
            borderRadius: '2rem',
            padding: '2.5rem',
          }}
        >
          <h1 style={{ fontSize: '1.9rem', fontWeight: 500, letterSpacing: '-0.04em', margin: '0 0 0.75rem' }}>
            Something went wrong
          </h1>

          <p className="muted" style={{ fontSize: '0.875rem', color: '#6e625b', margin: 0 }}>
            DevRel Studio failed to load. Your data is unaffected.
          </p>

          {error.digest && (
            <p
              className="muted"
              style={{
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: '0.75rem',
                color: '#6e625b',
                marginTop: '0.75rem',
              }}
            >
              Reference: {error.digest}
            </p>
          )}

          <button
            onClick={reset}
            style={{
              marginTop: '1.5rem',
              background: '#f16b46',
              color: '#f8f0e3',
              border: 'none',
              borderRadius: '2rem 0.5rem 0.5rem 2rem',
              padding: '0.8rem 1.5rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
