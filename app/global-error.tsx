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
          background: '#f5f5f5',
          color: '#1a1a1a',
        }}
      >
        <style>{`
          @media (prefers-color-scheme: dark) {
            body { background: #14181d !important; color: #e6e9ec !important; }
            .panel { background: #1b2027 !important; border-color: #2b323b !important; }
            .muted { color: #9aa5b1 !important; }
          }
        `}</style>

        <div
          className="panel"
          style={{
            maxWidth: '28rem',
            width: '100%',
            textAlign: 'center',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '0.75rem',
            padding: '2rem',
          }}
        >
          <h1 style={{ fontSize: '1.125rem', fontWeight: 600, margin: '0 0 0.5rem' }}>
            Something went wrong
          </h1>

          <p className="muted" style={{ fontSize: '0.875rem', color: '#718096', margin: 0 }}>
            DevRel Studio failed to load. Your data is unaffected.
          </p>

          {error.digest && (
            <p
              className="muted"
              style={{
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: '0.75rem',
                color: '#718096',
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
              background: '#38b2ac',
              color: '#ffffff',
              border: 'none',
              borderRadius: '0.5rem',
              padding: '0.6rem 1.1rem',
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
