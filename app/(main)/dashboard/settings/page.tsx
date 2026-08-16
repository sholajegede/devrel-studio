'use client'

import { useState, useEffect } from 'react'
import { useUserContext } from '@/contexts/user-context'
import { useMutation, useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { useTheme } from 'next-themes'
import {
  Loader2,
  AlertTriangle,
  Check,
  Copy,
  ExternalLink,
  Monitor,
  Moon,
  Sun,
  X as XIcon,
} from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { AdminTour, AdminTourTriggerButton, TourVariant } from '@/components/admin-onboarding-tour'

function SettingSection({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 lg:gap-10">
      <div className="pt-1">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{description}</p>
      </div>
      <div>{children}</div>
    </div>
  )
}

// ── Appearance ────────────────────────────────────────────────────────────────

const THEME_OPTIONS = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
] as const

function ThemeSetting() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // The server has no idea which theme the browser resolved, so rendering the
  // selection before mount would flag a hydration mismatch and briefly show the
  // wrong option as active.
  useEffect(() => setMounted(true), [])

  return (
    <Card data-tour="settings-appearance">
      <CardContent className="p-6">
        <div className="grid gap-3 sm:grid-cols-3">
          {THEME_OPTIONS.map((option) => {
            const isActive = mounted && theme === option.value
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setTheme(option.value)}
                aria-pressed={isActive}
                className={`flex items-center gap-2.5 rounded-lg border p-3 text-sm transition-colors ${
                  isActive
                    ? 'border-accent bg-accent/10 text-foreground'
                    : 'border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground'
                }`}
              >
                <option.icon className="h-4 w-4 shrink-0" />
                {option.label}
                {isActive && <Check className="ml-auto h-3.5 w-3.5 text-accent" />}
              </button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

// ── Public portfolio ──────────────────────────────────────────────────────────

function PortfolioSettings() {
  const { profile, setProfile } = useUserContext()
  const updatePortfolio = useMutation(api.portfolio.updatePortfolio)

  const [form, setForm] = useState({
    handle: '',
    bio: '',
    websiteUrl: '',
    githubUsername: '',
    twitterUsername: '',
  })
  const [isSaving, setIsSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!profile) return
    setForm({
      handle: profile.handle ?? '',
      bio: profile.bio ?? '',
      websiteUrl: profile.websiteUrl ?? '',
      githubUsername: profile.githubUsername ?? '',
      twitterUsername: profile.twitterUsername ?? '',
    })
  }, [profile])

  const trimmedHandle = form.handle.trim().toLowerCase().replace(/^@/, '')
  const handleChanged = trimmedHandle !== (profile?.handle ?? '')

  // Only ask the server while the handle is both non-empty and actually new —
  // otherwise every keystroke on the bio would fire an availability check.
  const availability = useQuery(
    api.portfolio.isHandleAvailable,
    trimmedHandle && handleChanged ? { handle: trimmedHandle } : 'skip'
  )

  const set = (field: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }))

  const portfolioUrl = profile?.handle
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/@${profile.handle}`
    : null

  const copyUrl = () => {
    if (!portfolioUrl) return
    navigator.clipboard.writeText(portfolioUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return

    setIsSaving(true)
    try {
      await updatePortfolio({
        handle: trimmedHandle,
        bio: form.bio,
        websiteUrl: form.websiteUrl,
        githubUsername: form.githubUsername,
        twitterUsername: form.twitterUsername,
      })

      setProfile({
        ...profile,
        handle: trimmedHandle || undefined,
        bio: form.bio.trim() || undefined,
        websiteUrl: form.websiteUrl.trim() || undefined,
        githubUsername: form.githubUsername.trim().replace(/^@/, '') || undefined,
        twitterUsername: form.twitterUsername.trim().replace(/^@/, '') || undefined,
      })

      toast.success(
        trimmedHandle ? 'Portfolio updated' : 'Portfolio unpublished'
      )
    } catch (error) {
      const message =
        error instanceof Error && 'data' in error && typeof error.data === 'string'
          ? error.data
          : 'Could not save your portfolio'
      toast.error(message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card>
      <CardContent className="p-6">
        <form onSubmit={handleSave} className="space-y-4">

          <div className="space-y-1.5">
            <Label htmlFor="handle">Handle</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">/@</span>
              <Input
                id="handle"
                value={form.handle}
                onChange={(e) => set('handle', e.target.value)}
                placeholder="yourname"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>

            {trimmedHandle && handleChanged && availability && (
              <p
                className={`flex items-center gap-1.5 text-xs ${
                  availability.available ? 'text-emerald-600' : 'text-destructive'
                }`}
              >
                {availability.available ? (
                  <><Check className="h-3 w-3" />@{trimmedHandle} is available</>
                ) : (
                  <><XIcon className="h-3 w-3" />{availability.reason}</>
                )}
              </p>
            )}

            {!trimmedHandle && (
              <p className="text-xs text-muted-foreground">
                Leave empty to keep your portfolio unpublished.
              </p>
            )}
          </div>

          {portfolioUrl && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
              <span className="flex-1 truncate font-mono text-xs text-muted-foreground">
                {portfolioUrl}
              </span>
              <button
                type="button"
                onClick={copyUrl}
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
              <a
                href={`/@${profile!.handle}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <ExternalLink className="h-3 w-3" />
                View
              </a>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              value={form.bio}
              onChange={(e) => set('bio', e.target.value)}
              placeholder="Developer advocate writing about auth, billing and the boring parts of SaaS."
              rows={3}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">
              {form.bio.length}/500
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="websiteUrl">Website</Label>
              <Input
                id="websiteUrl"
                value={form.websiteUrl}
                onChange={(e) => set('websiteUrl', e.target.value)}
                placeholder="yoursite.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="githubUsername">GitHub</Label>
              <Input
                id="githubUsername"
                value={form.githubUsername}
                onChange={(e) => set('githubUsername', e.target.value)}
                placeholder="username"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="twitterUsername">X / Twitter</Label>
              <Input
                id="twitterUsername"
                value={form.twitterUsername}
                onChange={(e) => set('twitterUsername', e.target.value)}
                placeholder="username"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              size="sm"
              disabled={
                isSaving ||
                (!!trimmedHandle && handleChanged && availability?.available === false)
              }
              className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {isSaving ? 'Saving…' : 'Save portfolio'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

export default function SettingsPage() {
  const { profile, setProfile } = useUserContext()
  const updateUser = useMutation(api.users.updateUser)
  const deleteUser = useMutation(api.users.deleteUser)

  const [isSaving,  setIsSaving]  = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [tourControls, setTourControls] = useState<{ startTour: () => void } | null>(null)

  const [form, setForm] = useState({
    firstName: profile?.firstName ?? '',
    lastName:  profile?.lastName  ?? '',
    email:     profile?.email     ?? '',
  })

  // Sync form if profile loads after mount
  useEffect(() => {
    if (profile) {
      setForm({
        firstName: profile.firstName ?? '',
        lastName:  profile.lastName  ?? '',
        email:     profile.email,
      })
    }
  }, [profile])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return
    setIsSaving(true)
    try {
      await updateUser({
        firstName: form.firstName,
        lastName: form.lastName,
      })
      setProfile({ ...profile, firstName: form.firstName, lastName: form.lastName })
      toast.success('Profile updated')
    } catch {
      toast.error('Failed to save. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (!profile) return
    setIsDeleting(true)
    try {
      await deleteUser({})
      window.location.href = '/api/auth/logout'
    } catch {
      toast.error('Failed to delete account. Please contact support.')
      setIsDeleting(false)
    }
  }

  const initials = profile
    ? (profile.firstName?.[0] ?? profile.email[0]).toUpperCase()
    : '?'

  const displayName = profile
    ? (profile.firstName ? `${profile.firstName} ${profile.lastName ?? ''}`.trim() : profile.email)
    : ''

  return (
    <main className="px-6 lg:px-10 py-8 max-w-400">

      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your profile and account preferences.</p>
        </div>
        <AdminTourTriggerButton onStartTour={() => tourControls?.startTour()} />
      </div>

      <div className="space-y-10">

        {/* Profile section */}
        <SettingSection
          title="Profile"
          description="Your public-facing name and contact email. Your email is managed by your authentication provider."
        >
          <Card data-tour="settings-profile">
            <CardContent className="p-6">
              {/* Avatar */}
              <div className="flex items-center gap-4 mb-6 pb-6 border-b border-border">
                <div className="h-14 w-14 rounded-full bg-primary flex items-center justify-center shrink-0">
                  <span className="text-xl font-semibold text-primary-foreground">{initials}</span>
                </div>
                <div>
                  <p className="font-medium text-foreground">{displayName}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Avatar synced from your Kinde account
                  </p>
                </div>
              </div>

              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="firstName">First name</Label>
                    <Input id="firstName" name="firstName" value={form.firstName} onChange={handleChange} placeholder="Jane" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="lastName">Last name</Label>
                    <Input id="lastName" name="lastName" value={form.lastName} onChange={handleChange} placeholder="Doe" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email address</Label>
                  <Input id="email" name="email" type="email" value={form.email} disabled className="bg-muted/40" />
                  <p className="text-xs text-muted-foreground">Managed via your authentication provider.</p>
                </div>
                <div className="flex justify-end pt-2">
                  <Button type="submit" size="sm" disabled={isSaving} className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
                    {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    {isSaving ? 'Saving…' : 'Save changes'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </SettingSection>

        <Separator />

        {/* Appearance */}
        <SettingSection
          title="Appearance"
          description="Choose a theme. System follows your operating system setting and changes with it."
        >
          <ThemeSetting />
        </SettingSection>

        <Separator />

        {/* Public portfolio */}
        <SettingSection
          title="Public portfolio"
          description="Claim a handle to publish everything you've shipped at devrel.studio/@handle. Only Published entries appear — drafts, scheduled work and client names stay private."
        >
          <PortfolioSettings />
        </SettingSection>

        <Separator />

        {/* Danger zone */}
        <SettingSection
          title="Danger Zone"
          description="These actions are permanent and cannot be undone. Proceed with caution."
        >
          <Card className="border-destructive/30" data-tour="settings-danger">
            <CardContent className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    Delete account
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Permanently removes your account and all content data.
                    This action cannot be reversed.
                  </p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0 border-destructive/40 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                    >
                      Delete Account
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete your account, all content entries, and client
                        dashboard data. This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDeleteAccount}
                        disabled={isDeleting}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {isDeleting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />}
                        Yes, delete my account
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        </SettingSection>

      </div>

      <AdminTour
        variant={'settings' as TourVariant}
        autoStart
        onTourControlReady={setTourControls}
      />
    </main>
  )
}
