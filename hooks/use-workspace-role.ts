'use client'

import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'

export type Role = 'owner' | 'admin' | 'editor' | 'viewer'

const RANK: Record<Role, number> = { viewer: 1, editor: 2, admin: 3, owner: 4 }

export interface Capabilities {
  /** Add content and clients. */
  create: boolean
  /** Change existing content and clients. */
  edit: boolean
  /** Remove content and clients. */
  delete: boolean
  /** Issue and revoke client dashboard access codes. */
  manageAccess: boolean
  /** Invite, re-role and remove members. */
  manageMembers: boolean
  /** Buy and upgrade plans. */
  manageBilling: boolean
}

const NONE: Capabilities = {
  create: false,
  edit: false,
  delete: false,
  manageAccess: false,
  manageMembers: false,
  manageBilling: false,
}

/**
 * What the signed-in user may do in their current workspace.
 *
 * This mirrors the role ladder enforced in convex/model/workspaces.ts — the
 * server remains the authority, and every mutation still checks. This exists so
 * the interface stops offering actions that are going to be refused: a viewer
 * clicking "Add Entry" and receiving an error is a worse answer than not being
 * shown the button.
 *
 * While the role is loading, `isLoading` is true and every capability is false.
 * Rendering controls optimistically and hiding them a moment later is a worse
 * flicker than showing them slightly late.
 */
export function useWorkspaceRole(): {
  role: Role | null
  isLoading: boolean
  can: Capabilities
  atLeast: (minimum: Role) => boolean
} {
  const membership = useQuery(api.members.getMyRole, {})

  const isLoading = membership === undefined
  const role = (membership?.role as Role | undefined) ?? null

  const atLeast = (minimum: Role) => (role ? RANK[role] >= RANK[minimum] : false)

  const can: Capabilities = role
    ? {
        create: atLeast('editor'),
        edit: atLeast('editor'),
        delete: atLeast('admin'),
        manageAccess: atLeast('admin'),
        manageMembers: atLeast('owner'),
        manageBilling: atLeast('owner'),
      }
    : NONE

  return { role, isLoading, can, atLeast }
}

/** Human-readable role, for badges and empty-state copy. */
export function roleLabel(role: Role | null): string {
  if (!role) return 'No access'
  return role.charAt(0).toUpperCase() + role.slice(1)
}
