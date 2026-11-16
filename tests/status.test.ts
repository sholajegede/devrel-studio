import { describe, expect, it } from 'vitest'
import { STATUS_LABELS, statusLabel, statusOptions } from '@/lib/status'

describe('status labels', () => {
  it('names the finished stage for the kind of content', () => {
    expect(statusLabel('Published', 'Event')).toBe('Delivered')
    expect(statusLabel('Published', 'Package')).toBe('Released')
    expect(statusLabel('Published', 'Demo')).toBe('Live')
    expect(statusLabel('Published', 'Written')).toBe('Published')
  })

  it('has a label for every stage of every category', () => {
    for (const labels of Object.values(STATUS_LABELS)) {
      for (const stage of ['Draft', 'Waiting Approval', 'Scheduled', 'Published'] as const) {
        expect(labels[stage].length).toBeGreaterThan(0)
      }
    }
  })

  it('shows an accepted Event as Delivered once its date has passed', () => {
    expect(statusLabel('Scheduled', 'Event', '2026-11-13', '2026-11-16')).toBe('Delivered')
    expect(statusLabel('Scheduled', 'Event', '2026-11-20', '2026-11-16')).toBe('Accepted')
    expect(statusLabel('Scheduled', 'Event', '2026-11-16', '2026-11-16')).toBe('Accepted')
  })

  it('applies the date rule to Events only', () => {
    expect(statusLabel('Scheduled', 'Written', '2020-01-01', '2026-11-16')).toBe('Scheduled')
  })

  it('ignores a missing or malformed date', () => {
    expect(statusLabel('Scheduled', 'Event', undefined, '2026-11-16')).toBe('Accepted')
    expect(statusLabel('Scheduled', 'Event', 'soon', '2026-11-16')).toBe('Accepted')
  })

  it('returns an unknown status unchanged', () => {
    expect(statusLabel('Archived', 'Event')).toBe('Archived')
  })

  it('lists the picker options in pipeline order with stored values', () => {
    expect(statusOptions('Event')).toEqual([
      { value: 'Draft', label: 'Planning' },
      { value: 'Waiting Approval', label: 'Submitted' },
      { value: 'Scheduled', label: 'Accepted' },
      { value: 'Published', label: 'Delivered' },
    ])
  })
})
