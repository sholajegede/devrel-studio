'use client'

import { useWorkspaceRole } from '@/hooks/use-workspace-role'
import { Eye } from 'lucide-react'

/**
 * Explains why the write controls are missing.
 *
 * Hiding buttons a role cannot use is better than letting them fail, but on its
 * own it is indistinguishable from a broken page — the user sees a dashboard
 * with no way to act and no reason given. This says the reason once, at the top,
 * and only for the role that needs it.
 */
export function RoleNotice() {
  const { role, isLoading } = useWorkspaceRole()

  if (isLoading || role !== 'viewer') return null

  return (
    <div className="mb-6 flex items-start gap-2.5 rounded-lg border border-border bg-muted/40 px-3.5 py-2.5">
      <Eye className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <p className="text-xs leading-relaxed text-muted-foreground">
        <span className="font-medium text-foreground">You have view-only access</span> to this
        workspace. You can read and export everything here, but adding and editing is
        turned off. Ask the workspace owner for editor access if you need it.
      </p>
    </div>
  )
}
