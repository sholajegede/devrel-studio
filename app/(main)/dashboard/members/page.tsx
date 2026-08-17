'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useMutation, useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import { useUserContext } from '@/contexts/user-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Loader2, Mail, UserPlus, Users, X, Clock, ShieldCheck, Eye, Edit3, Info } from 'lucide-react'
import { AdminTour, AdminTourTriggerButton, TourVariant } from '@/components/admin-onboarding-tour'

type Role = 'admin' | 'editor' | 'viewer'

const ROLE_META: Record<Role, { label: string; description: string; icon: React.ElementType }> = {
  admin:  { label: 'Admin',  description: 'Full access \u2014 add, edit, delete, manage members', icon: ShieldCheck },
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
  const [inviteRole,  setInviteRole]  = useState<Role>('editor')
  const [isSending,   setIsSending]   = useState(false)
  const [inviteLink,  setInviteLink]  = useState<string | null>(null)
  const [tourControls, setTourControls] = useState<{ startTour: () => void } | null>(null)

  const pendingInvites = useQuery(api.members.listInvites, profile?._id ? {} : 'skip')
  const seats = useQuery(api.members.getSeatUsage, profile?._id ? {} : 'skip')
  const members = useQuery(api.members.listMembers, profile?._id ? {} : 'skip')
  const revokeInvite = useMutation(api.members.revokeInvite)
  const updateMemberRole = useMutation(api.members.updateMemberRole)
  const removeMember = useMutation(api.members.removeMember)

  const invites = pendingInvites ?? []
  const isOwner = seats?.yourRole === 'owner'
  const seatsFull = !!seats && seats.used >= seats.seats

  const initials = profile
    ? (profile.firstName?.[0] ?? profile.email[0]).toUpperCase()
    : '?'
  const displayName = profile
    ? (profile.firstName ? `${profile.firstName} ${profile.lastName ?? ''}`.trim() : profile.email)
    : ''

  /** ConvexError carries a readable message in `data`; anything else does not. */
  const errorMessage = (error: unknown, fallback: string) =>
    error && typeof error === 'object' && 'data' in error && typeof error.data === 'string'
      ? error.data
      : fallback

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail.trim()) return

    const email = inviteEmail.trim()
    setIsSending(true)
    try {
      const response = await fetch('/api/members/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role: inviteRole }),
      })
      const body = await response.json()

      if (!response.ok) {
        toast.error(body.error ?? 'Could not create that invitation')
        return
      }

      setInviteEmail('')
      setInviteLink(body.acceptUrl)

      // Distinguish "sent" from "created but you'll have to share the link" —
      // without a mail provider configured the second is the normal outcome.
      toast.success(
        body.emailed ? `Invitation sent to ${email}` : `Invitation created — copy the link below`,
      )
    } catch {
      toast.error('Could not create that invitation')
    } finally {
      setIsSending(false)
    }
  }

  const changeRole = async (membershipId: Id<'memberships'>, role: Role) => {
    try {
      await updateMemberRole({ membershipId, role })
      toast.success('Role updated')
    } catch (error) {
      toast.error(errorMessage(error, 'Could not update that role'))
    }
  }

  const kickMember = async (membershipId: Id<'memberships'>, name: string) => {
    try {
      await removeMember({ membershipId })
      toast.success(`${name} no longer has access`)
    } catch (error) {
      toast.error(errorMessage(error, 'Could not remove that member'))
    }
  }

  const cancelInvite = async (id: Id<'workspaceInvites'>) => {
    try {
      await revokeInvite({ inviteId: id })
      toast.success('Invitation cancelled')
    } catch (error) {
      toast.error(errorMessage(error, 'Could not cancel that invitation'))
    }
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
          description="Everyone in this workspace. The owner keeps full control and no one can remove them."
        >
          <Card>
            <CardContent className="p-0">
              {(members ?? []).map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-3 px-5 py-4 border-b border-border last:border-b-0"
                >
                  <div className="h-9 w-9 rounded-full bg-primary flex items-center justify-center shrink-0">
                    <span className="text-sm font-semibold text-primary-foreground">
                      {(member.name[0] ?? member.email[0]).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">
                      {member.name}
                      {member.isYou && (
                        <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                          (you)
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                  </div>

                  {/* Only the owner can change roles, and the owner's own role
                      is fixed — there is no one to hand the workspace to yet. */}
                  {isOwner && member.role !== 'owner' ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <Select
                        value={member.role}
                        onValueChange={(value) => changeRole(member.id, value as Role)}
                      >
                        <SelectTrigger className="h-8 w-[120px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(ROLE_META) as Role[]).map((role) => (
                            <SelectItem key={role} value={role} className="text-xs">
                              {ROLE_META[role].label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => kickMember(member.id, member.name)}
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                        aria-label={`Remove ${member.name}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <Badge variant="secondary" className="text-xs shrink-0 capitalize">
                      {member.role}
                    </Badge>
                  )}
                </div>
              ))}

              {seats && (
                <div className="border-t border-border px-5 py-3 bg-muted/20">
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    {seats.used} of {seats.seats} seat{seats.seats === 1 ? '' : 's'} used on
                    the {seats.planName} plan
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
          description="Send someone an invite link. Opening it puts them in this workspace with the role you pick."
        >
          <Card data-tour="members-invite">
            <CardContent className="p-6">
              {inviteLink && (
                <div className="mb-5 rounded-lg border border-sky-200 bg-sky-50/60 dark:border-sky-500/30 dark:bg-sky-500/10 px-3 py-2.5">
                  <div className="flex items-start gap-2.5">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-600 dark:text-sky-400" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-sky-900 dark:text-sky-200">
                        Invitation link
                      </p>
                      <p className="mt-0.5 text-xs leading-relaxed text-sky-900/80 dark:text-sky-200/80">
                        Share this if the email does not arrive. It expires in 14 days.
                      </p>
                      <code className="mt-2 block truncate rounded bg-background/60 px-2 py-1 text-[11px] font-mono">
                        {inviteLink}
                      </code>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(inviteLink)
                        toast.success('Link copied')
                      }}
                      className="h-7 shrink-0 text-xs"
                    >
                      Copy
                    </Button>
                  </div>
                </div>
              )}

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
                    <Select
                      value={inviteRole}
                      onValueChange={(value) => setInviteRole(value as Role)}
                    >
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

                <div className="flex items-center justify-between gap-3">
                  {seatsFull ? (
                    <p className="text-xs text-muted-foreground">
                      All {seats!.seats} seat{seats!.seats === 1 ? '' : 's'} on the{' '}
                      {seats!.planName} plan are in use.{' '}
                      <Link href="/dashboard/billing" className="text-accent hover:underline">
                        Upgrade
                      </Link>{' '}
                      to add more.
                    </p>
                  ) : (
                    <span />
                  )}
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isSending || seatsFull}
                    className="gap-2 shrink-0"
                  >
                    {isSending
                      ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Saving…</>
                      : <><UserPlus className="h-3.5 w-3.5" />Create Invite</>
                    }
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </SettingSection>

        {/* Pending invitations */}
        {invites.length > 0 && (
          <>
            <Separator />
            <SettingSection
              title="Pending invitations"
              description="Invites nobody has opened yet. Cancel one to free the seat."
            >
              <Card>
                <CardContent className="p-0 divide-y divide-border">
                  {invites.map((invite) => {
                    const roleInfo = ROLE_META[invite.role as Role]
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
                            Created {new Date(invite.invitedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            {' · expires '}
                            {new Date(invite.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
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
          description="Your plan sets the number of seats. Agency raises this workspace to 5."
        >
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {seats
                      ? `${seats.used} of ${seats.seats} seat${seats.seats === 1 ? '' : 's'} used`
                      : 'Loading…'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {seats ? `Current plan: ${seats.planName}` : ''}
                  </p>
                </div>
                <Link href="/dashboard/billing">
                  <Button variant="outline" size="sm" className="gap-1.5 shrink-0">
                    Upgrade for more seats
                  </Button>
                </Link>
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
