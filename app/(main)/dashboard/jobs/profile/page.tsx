'use client'

import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { FileText, Loader2, Trash2, Upload, X } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/convex/_generated/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { JobsHeader } from '@/components/jobs/jobs-tabs'
import { RoleNotice } from '@/components/dashboard/role-notice'
import { COUNTRY_OPTIONS } from '@/lib/jobs/locations'
import { SKILL_NAMES } from '@/lib/jobs/skills'
import { FAMILIES, SENIORITIES } from '@/lib/jobs/taxonomy'

const MAX_BYTES = 5 * 1024 * 1024
const WORKPLACES = [
  { id: 'remote', label: 'Remote' },
  { id: 'hybrid', label: 'Hybrid' },
  { id: 'onsite', label: 'On-site' },
]

export default function ProfilePage() {
  const profile = useQuery(api.jobBoard.myProfile)
  const generateUrl = useMutation(api.jobBoard.generateCvUploadUrl)
  const attachCv = useMutation(api.jobBoard.attachCv)
  const setCvText = useMutation(api.jobBoard.setCvText)
  const removeCv = useMutation(api.jobBoard.removeCv)
  const saveProfile = useMutation(api.jobBoard.saveProfile)

  const [skills, setSkills] = useState<string[]>([])
  const [families, setFamilies] = useState<string[]>([])
  const [seniority, setSeniority] = useState('')
  const [workplaces, setWorkplaces] = useState<string[]>([])
  const [country, setCountry] = useState('')
  const [minSalary, setMinSalary] = useState('')
  const [needsVisa, setNeedsVisa] = useState(false)
  const [headline, setHeadline] = useState('')
  const [skillInput, setSkillInput] = useState('')
  const [pasted, setPasted] = useState('')
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const loadedAt = profile && profile.exists ? profile.updatedAt : null
  useEffect(() => {
    if (!profile || !profile.exists) return
    setSkills(profile.skills)
    setFamilies(profile.families)
    setSeniority(profile.seniority ?? '')
    setWorkplaces(profile.workplaces)
    setCountry(profile.country ?? '')
    setMinSalary(profile.minSalaryUsd ? String(profile.minSalaryUsd) : '')
    setNeedsVisa(Boolean(profile.needsVisa))
    setHeadline(profile.headline ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedAt])

  const status = profile && profile.exists ? profile.cvStatus : undefined

  const upload = async (file: File) => {
    if (file.size > MAX_BYTES) return toast.error('Files up to 5 MB, please')
    if (!/\.(pdf|txt|md)$/i.test(file.name)) return toast.error('Upload a PDF, or paste the text below')
    setUploading(true)
    try {
      const url = await generateUrl()
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      })
      if (!response.ok) throw new Error('Upload failed')
      const { storageId } = (await response.json()) as { storageId: string }
      await attachCv({ storageId: storageId as never, fileName: file.name, contentType: file.type || undefined })
      toast.success('CV uploaded. Reading it now')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not upload')
    } finally {
      setUploading(false)
    }
  }

  const addSkill = (value: string) => {
    const clean = value.trim()
    if (!clean || skills.some((skill) => skill.toLowerCase() === clean.toLowerCase())) return
    setSkills([...skills, clean])
    setSkillInput('')
  }

  const toggle = (list: string[], set: (next: string[]) => void, id: string) =>
    set(list.includes(id) ? list.filter((item) => item !== id) : [...list, id])

  const save = async () => {
    setSaving(true)
    try {
      await saveProfile({
        skills,
        families,
        seniority: seniority || undefined,
        workplaces,
        country: country || undefined,
        minSalaryUsd: minSalary ? Number(minSalary) : undefined,
        needsVisa: needsVisa || undefined,
        headline: headline || undefined,
      })
      toast.success('Preferences saved')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  const hasCv = profile && profile.exists && profile.hasCv

  return (
    <main className="px-6 py-8 lg:px-10 max-w-400">
      <RoleNotice />
      <JobsHeader
        title="CV & preferences"
        description="What the board uses to rank roles for you. Your CV is read once, to find skills and focus, and is only visible to you."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-4 rounded-xl border border-border bg-card p-5">
          <h2 className="font-medium text-foreground">Your CV</h2>

          <div
            onDragOver={(event) => {
              event.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault()
              setDragging(false)
              const file = event.dataTransfer.files?.[0]
              if (file) void upload(file)
            }}
            className={`flex flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-center transition-colors ${
              dragging ? 'border-accent bg-accent/5' : 'border-border'
            }`}
          >
            {uploading || status === 'processing' ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
              <Upload className="h-6 w-6 text-muted-foreground" />
            )}
            <p className="text-sm text-foreground">
              {uploading ? 'Uploading' : status === 'processing' ? 'Reading your CV' : 'Drop your CV here'}
            </p>
            <p className="text-xs text-muted-foreground">PDF or text, up to 5 MB</p>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.txt,.md,application/pdf,text/plain"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void upload(file)
                event.target.value = ''
              }}
            />
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
              Choose a file
            </Button>
          </div>

          {hasCv && profile && profile.exists && (
            <div className="flex items-center justify-between gap-3 rounded-lg bg-muted p-3 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{profile.cvFileName ?? 'CV'}</span>
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  await removeCv()
                  toast.success('CV deleted')
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </Button>
            </div>
          )}

          {status === 'unreadable' && (
            <p className="text-sm text-destructive">
              That file had no readable text. It may be a scan. Paste the text below instead.
            </p>
          )}

          <div className="space-y-2">
            <label htmlFor="paste" className="text-sm font-medium text-foreground">
              Or paste the text
            </label>
            <Textarea
              id="paste"
              value={pasted}
              onChange={(event) => setPasted(event.target.value)}
              rows={6}
              placeholder="Paste your CV as plain text"
            />
            <Button
              variant="outline"
              size="sm"
              disabled={pasted.trim().length < 80}
              onClick={async () => {
                try {
                  await setCvText({ text: pasted })
                  setPasted('')
                  toast.success('CV read')
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : 'Could not read that')
                }
              }}
            >
              Read this text
            </Button>
          </div>
        </section>

        <section className="space-y-5 rounded-xl border border-border bg-card p-5">
          <h2 className="font-medium text-foreground">What you are looking for</h2>

          <div className="space-y-2">
            <label htmlFor="headline" className="text-sm font-medium text-foreground">
              Headline
            </label>
            <Input id="headline" value={headline} onChange={(event) => setHeadline(event.target.value)} maxLength={120} />
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-foreground">Focus</legend>
            <div className="flex flex-wrap gap-2">
              {FAMILIES.map((family) => (
                <button
                  key={family.id}
                  type="button"
                  aria-pressed={families.includes(family.id)}
                  onClick={() => toggle(families, setFamilies, family.id)}
                  className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                    families.includes(family.id)
                      ? 'border-foreground/25 bg-secondary text-foreground'
                      : 'border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {family.label}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="level" className="text-sm font-medium text-foreground">
                Level
              </label>
              <select
                id="level"
                value={seniority}
                onChange={(event) => setSeniority(event.target.value)}
                className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
              >
                <option value="">Not set</option>
                {SENIORITIES.map((level) => (
                  <option key={level.id} value={level.id}>
                    {level.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="country" className="text-sm font-medium text-foreground">
                Where you live
              </label>
              <select
                id="country"
                value={country}
                onChange={(event) => setCountry(event.target.value)}
                className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
              >
                <option value="">Not set</option>
                {COUNTRY_OPTIONS.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-foreground">Workplace</legend>
            <div className="flex flex-wrap gap-4">
              {WORKPLACES.map((place) => (
                <label key={place.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={workplaces.includes(place.id)}
                    onChange={() => toggle(workplaces, setWorkplaces, place.id)}
                    className="h-3.5 w-3.5 accent-[var(--accent)]"
                  />
                  {place.label}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="flex cursor-pointer items-start gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={needsVisa}
              onChange={(event) => setNeedsVisa(event.target.checked)}
              className="mt-0.5 h-3.5 w-3.5 accent-[var(--accent)]"
            />
            <span>
              I need visa sponsorship
              <span className="block text-xs text-muted-foreground">Roles that sponsor rank higher. Roles that say they do not sponsor rank lower.</span>
            </span>
          </label>

          <div className="space-y-2">
            <label htmlFor="min" className="text-sm font-medium text-foreground">
              Minimum yearly pay in US dollars
            </label>
            <Input
              id="min"
              inputMode="numeric"
              value={minSalary}
              onChange={(event) => setMinSalary(event.target.value.replace(/[^0-9]/g, ''))}
              placeholder="100000"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="skill" className="text-sm font-medium text-foreground">
              Skills ({skills.length})
            </label>
            <div className="flex flex-wrap gap-1.5">
              {skills.map((skill) => (
                <Badge key={skill} variant="secondary" className="gap-1 font-normal">
                  {skill}
                  <button
                    type="button"
                    onClick={() => setSkills(skills.filter((item) => item !== skill))}
                    aria-label={`Remove ${skill}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <Input
              id="skill"
              list="skill-options"
              value={skillInput}
              onChange={(event) => setSkillInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  addSkill(skillInput)
                }
              }}
              placeholder="Add a skill and press Enter"
            />
            <datalist id="skill-options">
              {SKILL_NAMES.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>

          <Button onClick={save} disabled={saving} className="bg-accent text-accent-foreground hover:bg-accent/90">
            {saving ? 'Saving' : 'Save preferences'}
          </Button>
        </section>
      </div>
    </main>
  )
}
