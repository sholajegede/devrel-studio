'use client'

import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { Check, ChevronsUpDown, Users } from 'lucide-react'

/**
 * Switch between workspaces.
 *
 * Hidden entirely for the common case of one workspace — most people are only
 * ever in their own, and a control that never does anything is noise. It appears
 * the moment someone accepts an invitation, which is also the moment they need a
 * way back to their own workspace.
 */
export function WorkspaceSwitcher({ onNavigate }: { onNavigate?: () => void }) {
  const workspaces = useQuery(api.members.listMyWorkspaces, {})
  const switchWorkspace = useMutation(api.members.switchWorkspace)

  if (!workspaces || workspaces.length < 2) return null

  const active = workspaces.find((workspace) => workspace.isActive) ?? workspaces[0]

  const choose = async (workspaceId: Id<'workspaces'>) => {
    if (workspaceId === active.id) return
    try {
      await switchWorkspace({ workspaceId })
      onNavigate?.()
    } catch {
      toast.error('Could not switch workspace')
    }
  }

  return (
    <div className="border-b border-border px-3 py-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted"
          >
            <Users className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate text-sm text-foreground">
              {active.name}
            </span>
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel className="text-xs">Workspaces</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {workspaces.map((workspace) => (
            <DropdownMenuItem
              key={workspace.id}
              onClick={() => choose(workspace.id)}
              className="gap-2 text-sm"
            >
              <span className="min-w-0 flex-1 truncate">{workspace.name}</span>
              <span className="shrink-0 text-[11px] capitalize text-muted-foreground">
                {workspace.role}
              </span>
              {workspace.isActive && <Check className="h-3.5 w-3.5 shrink-0" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
