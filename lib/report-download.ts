/**
 * Tell DevRel Studio a report PDF was saved. Fire and forget: a download must
 * never fail, or wait, because it could not be counted.
 */
export function trackReportDownload(target: string, period?: string): void {
  try {
    void fetch('/api/track/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target, period }),
      keepalive: true,
    }).catch(() => {})
  } catch {
    // Nothing to do.
  }
}
