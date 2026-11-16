import type { Category, Status } from './types'

// ── Status names per content type ─────────────────────────────────────────────
//
// An entry has one of four stored stages. The stage is what the pipeline board,
// the filters and the reports work from, so it never changes. What a person
// reads on screen is a label chosen for the kind of content: a talk is
// "Delivered", a package is "Released", a blog post is "Published".
//
// Reports sent to clients keep the neutral stage names on purpose. A client
// should not read "Delivered" next to a blog post.

type Labels = Record<Status, string>

export const STATUS_LABELS: Record<Category, Labels> = {
  Written: { Draft: 'Draft', 'Waiting Approval': 'In review', Scheduled: 'Scheduled', Published: 'Published' },
  Video: { Draft: 'Draft', 'Waiting Approval': 'In review', Scheduled: 'Scheduled', Published: 'Published' },
  Event: { Draft: 'Planning', 'Waiting Approval': 'Submitted', Scheduled: 'Accepted', Published: 'Delivered' },
  Podcast: { Draft: 'Planned', 'Waiting Approval': 'Recorded', Scheduled: 'Scheduled', Published: 'Released' },
  Package: { Draft: 'In development', 'Waiting Approval': 'In review', Scheduled: 'Pre-release', Published: 'Released' },
  Demo: { Draft: 'Building', 'Waiting Approval': 'In review', Scheduled: 'Ready to ship', Published: 'Live' },
}

/** The stage names, for places that mix categories (the pipeline board columns). */
export const STAGE_LABELS: Labels = {
  Draft: 'Draft',
  'Waiting Approval': 'In review',
  Scheduled: 'Scheduled',
  Published: 'Published',
}

const DAY = /^\d{4}-\d{2}-\d{2}$/

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * The words to show for an entry's status.
 *
 * An Event that is "Accepted" and whose date has passed reads "Delivered": the
 * talk happened, and nobody should have to come back to say so. The stored
 * stage stays Scheduled until the person moves it.
 */
export function statusLabel(
  status: string,
  category: Category = 'Written',
  publicationDate?: string,
  now: string = today(),
): string {
  const labels = STATUS_LABELS[category] ?? STATUS_LABELS.Written
  if (!(status in labels)) return status
  const stage = status as Status
  if (
    category === 'Event' &&
    stage === 'Scheduled' &&
    publicationDate &&
    DAY.test(publicationDate) &&
    publicationDate < now
  ) {
    return labels.Published
  }
  return labels[stage]
}

/** Options for the status picker in the entry form. */
export function statusOptions(category: Category): { value: Status; label: string }[] {
  const labels = STATUS_LABELS[category] ?? STATUS_LABELS.Written
  return (['Draft', 'Waiting Approval', 'Scheduled', 'Published'] as const).map((value) => ({
    value,
    label: labels[value],
  }))
}
