'use client'

import { useState } from 'react'
import { useUserContext } from '@/contexts/user-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Loader2, Mail, UserPlus, Users, X, Clock, ShieldCheck, Eye, Edit3 } from 'lucide-react'
import { AdminTour, AdminTourTriggerButton, TourVariant } from '@/components/admin-onboarding-tour'

interface PendingInvite {
  id: string
  email: string
  role: string
  sentAt: Date
}

const ROLE_META: Record<string, { label: string; description: string; icon: React.ElementType }> = {
  admin:  { label: 'Admin',  description: 'Full access — add, edit, delete, manage members', icon: ShieldCheck },
  editor: { label: 'Editor', description: 'Add and edit content, cannot delete or manage members', icon: Edit3 },
  viewer: { label: 'Viewer', description: 'Read-only access to the admin dashboard', icon: Eye },
}

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

export default function MembersPage() {
  const { profile } = useUserContext()
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole,  setInviteRole]  = useState('editor')
  const [isSending,   setIsSending]   = useState(false)
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([])
  const [tourControls, setTourControls] = useState<{ startTour: () => void } | null>(null)

  const initials = profile
    ? (profile.firstName?.[0] ?? profile.email[0]).toUpperCase()
    : '?'
  const displayName = profile
    ? (profile.firstName ? `${profile.firstName} ${profile.lastName ?? ''}`.trim() : profile.email)
    : ''

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    setIsSending(true)
    await new Promise((r) => setTimeout(r, 900))
    setPendingInvites((prev) => [
      ...prev,
      { id: crypto.randomUUID(), email: inviteEmail.trim(), role: inviteRole, sentAt: new Date() },
    ])
    toast.success(`Invitation sent to ${inviteEmail.trim()}`)
    setInviteEmail('')
    setIsSending(false)
  }

  const cancelInvite = (id: string) => {
    setPendingInvites((prev) => prev.filter((inv) => inv.id !== id))
    toast.success('Invitation cancelled')
  }

  return (
    <main className="px-6 lg:px-10 py-8 max-w-400">

      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Members</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage who has access to your DevRel Studio workspace.
          </p>
        </div>
        <AdminTourTriggerButton onStartTour={() => tourControls?.startTour()} />
      </div>

      <div className="space-y-10">

        {/* Current members */}
        <SettingSection
          title="Workspace members"
          description="Everyone with access to this workspace. The owner has full control and cannot be removed."
        >
          <Card>
            <CardContent className="p-0">
              <div className="flex items-center gap-3 px-5 py-4">
                <div className="h-9 w-9 rounded-full bg-primary flex items-center justify-center shrink-0">
                  <span className="text-sm font-semibold text-primary-foreground">{initials}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
                  <p className="text-xs text-muted-foreground truncate">{profile?.email}</p>
                </div>
                <Badge variant="secondary" className="text-xs shrink-0">Owner</Badge>
              </div>

              {pendingInvites.length === 0 && (
                <div className="border-t border-border px-5 py-3 bg-muted/20">
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    1 of 1 seat used on your current plan
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </SettingSection>

        <Separator />

        {/* Invite */}
        <SettingSection
          title="Invite a team member"
          description="Send an email invitation to give someone access to your workspace. They'll be prompted to create an account if they don't have one."
        >
          <Card data-tour="members-invite">
            <CardContent className="p-6">
              <form onSubmit={handleInvite} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="inviteEmail">Email address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="inviteEmail"
                        type="email"
                        placeholder="colleague@company.com"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        className="pl-9"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="inviteRole">Role</Label>
                    <Select value={inviteRole} onValueChange={setInviteRole}>
                      <SelectTrigger id="inviteRole">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(ROLE_META).map(([value, { label }]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Role description */}
                {inviteRole && ROLE_META[inviteRole] && (() => {
                  const { description, icon: Icon } = ROLE_META[inviteRole]
                  return (
                    <div className="flex items-start gap-2 rounded-lg bg-muted/40 border border-border px-3 py-2.5 text-xs text-muted-foreground">
                      <Icon className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <span>{description}</span>
                    </div>
                  )
                })()}

                <div className="flex justify-end">
                  <Button type="submit" size="sm" disabled={isSending} className="gap-2">
                    {isSending
                      ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Sending…</>
                      : <><UserPlus className="h-3.5 w-3.5" />Send Invite</>
                    }
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </SettingSection>

        {/* Pending invitations */}
        {pendingInvites.length > 0 && (
          <>
            <Separator />
            <SettingSection
              title="Pending invitations"
              description="These invitations have been sent but not yet accepted. You can cancel any invitation at any time."
            >
              <Card>
                <CardContent className="p-0 divide-y divide-border">
                  {pendingInvites.map((invite) => {
                    const roleInfo = ROLE_META[invite.role]
                    const RoleIcon = roleInfo?.icon
                    return (
                      <div key={invite.id} className="flex items-center gap-3 px-5 py-4">
                        <div className="h-9 w-9 rounded-full border-2 border-dashed border-border flex items-center justify-center shrink-0">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate">{invite.email}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Clock className="h-3 w-3" />
                            Sent {invite.sentAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="outline" className="text-xs gap-1">
                            {RoleIcon && <RoleIcon className="h-3 w-3" />}
                            {roleInfo?.label ?? invite.role}
                          </Badge>
                          <button
                            type="button"
                            onClick={() => cancelInvite(invite.id)}
                            className="rounded-md p-1 hover:bg-muted transition-colors"
                            aria-label="Cancel invitation"
                          >
                            <X className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            </SettingSection>
          </>
        )}

        <Separator />

        {/* Seat usage */}
        <SettingSection
          title="Seat usage"
          description="Your current plan includes 1 seat. Upgrade to the Agency plan to add up to 5 team members."
        >
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">1 of 1 seat used</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Current plan: Free Trial</p>
                </div>
                <Button variant="outline" size="sm" className="gap-1.5">
                  Upgrade for more seats
                </Button>
              </div>
            </CardContent>
          </Card>
        </SettingSection>

      </div>

      <AdminTour
        variant={'members' as TourVariant}
        autoStart
        onTourControlReady={setTourControls}
      />
    </main>
  )
}
