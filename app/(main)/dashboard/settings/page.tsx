'use client'

import { useState, useEffect } from 'react'
import { useUserContext } from '@/contexts/user-context'
import { useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { Loader2, AlertTriangle } from 'lucide-react'
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
        userId: profile._id,
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
      await deleteUser({ userId: profile._id })
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

        {/* Preferences */}
        <SettingSection
          title="Preferences"
          description="Appearance and notification settings for your workspace."
        >
          <Card data-tour="settings-preferences">
            <CardContent className="p-0 divide-y divide-border">
              <div className="flex items-center justify-between px-6 py-4">
                <div>
                  <p className="text-sm font-medium text-foreground">Theme</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Light mode only at this time.</p>
                </div>
                <div className="rounded-md border border-border bg-muted px-3 py-1.5 text-xs text-muted-foreground">
                  Light
                </div>
              </div>
              <div className="flex items-center justify-between px-6 py-4">
                <div>
                  <p className="text-sm font-medium text-foreground">Email notifications</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Product updates and account alerts.</p>
                </div>
                <div className="rounded-md border border-border bg-muted px-3 py-1.5 text-xs text-muted-foreground">
                  Coming soon
                </div>
              </div>
            </CardContent>
          </Card>
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
