export const STAGES = [
  { id: 'saved', label: 'Saved', column: 'saved' },
  { id: 'applied', label: 'Applied', column: 'applied' },
  { id: 'screening', label: 'Screening', column: 'screening' },
  { id: 'interview', label: 'Interviewing', column: 'interview' },
  { id: 'offer', label: 'Offer', column: 'offer' },
  { id: 'accepted', label: 'Accepted', column: 'closed' },
  { id: 'rejected', label: 'Rejected', column: 'closed' },
  { id: 'withdrawn', label: 'Withdrawn', column: 'closed' },
] as const

export type StageId = (typeof STAGES)[number]['id']

export const STAGE_IDS = STAGES.map((stage) => stage.id) as StageId[]

export function isStageId(value: string): value is StageId {
  return (STAGE_IDS as string[]).includes(value)
}

export const COLUMNS = [
  { id: 'saved', label: 'Saved' },
  { id: 'applied', label: 'Applied' },
  { id: 'screening', label: 'Screening' },
  { id: 'interview', label: 'Interviewing' },
  { id: 'offer', label: 'Offer' },
  { id: 'closed', label: 'Closed' },
] as const

export function stageLabel(id: string): string {
  return STAGES.find((stage) => stage.id === id)?.label ?? id
}

export function columnOf(id: string): string {
  return STAGES.find((stage) => stage.id === id)?.column ?? 'saved'
}

export const ACTIVE_STAGES: StageId[] = ['applied', 'screening', 'interview', 'offer']
