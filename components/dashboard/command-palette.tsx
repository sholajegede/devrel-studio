'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { useMutation, useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import { useWorkspaceRole } from '@/hooks/use-workspace-role'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command'
import { toast } from 'sonner'
import {
  Building2,
  CreditCard,
  ExternalLink,
  FileText,
  Kanban,
  LayoutDashboard,
  Monitor,
  Moon,
  PlusCircle,
  Settings,
  Sun,
  Users,
} from 'lucide-react'

/**
 * ⌘K palette.
 *
 * The fastest path to anywhere in the app, and the thing that makes a dashboard
 * feel like a tool rather than a website. Three groups: go somewhere, do
 * something, change a setting.
 *
 * Actions the caller's role cannot perform are omitted rather than shown
 * disabled — a palette is a list you filter by typing, and unusable rows make
 * that list worse.
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const { setTheme } = useTheme()
  const { can } = useWorkspaceRole()

  const clients = useQuery(api.clients.getClients, {})
  // The palette navigated but could not find. "Where is that post about
  // webhooks" is the question people actually bring to ⌘K.
  const content = useQuery(api.content.getAllContent, {})
  const workspaces = useQuery(api.members.listMyWorkspaces, {})
  const switchWorkspace = useMutation(api.members.switchWorkspace)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Ctrl as well as Cmd: the shortcut should work the same on Windows.
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen((previous) => !previous)
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  /** Close first, then act — otherwise the dialog animates out over the new page. */
  const run = (action: () => void) => {
    setOpen(false)
    action()
  }

  const go = (href: string) => run(() => router.push(href))

  const moveWorkspace = (workspaceId: Id<'workspaces'>, name: string) =>
    run(async () => {
      try {
        await switchWorkspace({ workspaceId })
        toast.success(`Switched to ${name}`)
        router.refresh()
      } catch {
        toast.error('Could not switch workspace')
      }
    })

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search or jump to…" />

      <CommandList>
        <CommandEmpty>Nothing matches that.</CommandEmpty>

        <CommandGroup heading="Go to">
          <CommandItem onSelect={() => go('/dashboard')}>
            <LayoutDashboard className="h-4 w-4" />
            Overview
          </CommandItem>
          <CommandItem onSelect={() => go('/dashboard/content')}>
            <FileText className="h-4 w-4" />
            All content
          </CommandItem>
          <CommandItem onSelect={() => go('/dashboard/pipeline')}>
            <Kanban className="h-4 w-4" />
            Pipeline
          </CommandItem>
          <CommandItem onSelect={() => go('/dashboard/clients')}>
            <Building2 className="h-4 w-4" />
            Clients
          </CommandItem>
          <CommandItem onSelect={() => go('/dashboard/members')}>
            <Users className="h-4 w-4" />
            Members
          </CommandItem>
          <CommandItem onSelect={() => go('/dashboard/billing')}>
            <CreditCard className="h-4 w-4" />
            Billing
          </CommandItem>
          <CommandItem onSelect={() => go('/dashboard/settings')}>
            <Settings className="h-4 w-4" />
            Settings
          </CommandItem>
        </CommandGroup>

        {can.create && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Create">
              <CommandItem onSelect={() => go('/dashboard/add')}>
                <PlusCircle className="h-4 w-4" />
                New content entry
                <CommandShortcut>C</CommandShortcut>
              </CommandItem>
            </CommandGroup>
          </>
        )}

        {content && content.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Content">
              {/* cmdk filters and ranks; capping the rendered set keeps a large
                  library from putting thousands of nodes in the dialog. */}
              {content.slice(0, 200).map((entry) => (
                <CommandItem
                  key={entry._id}
                  value={`content ${entry.title} ${entry.platform} ${entry.client} ${(entry.tags ?? []).join(' ')}`}
                  onSelect={() => go(`/dashboard/edit/${entry._id}`)}
                >
                  <FileText className="h-4 w-4" />
                  <span className="min-w-0 flex-1 truncate">{entry.title}</span>
                  <CommandShortcut>{entry.platform}</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* Opening a client's live dashboard is the single most repeated action
            before a check-in call, and it is otherwise three clicks deep. */}
        {clients && clients.some((client) => client.slug) && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Open client dashboard">
              {clients
                .filter((client) => client.slug)
                .map((client) => (
                  <CommandItem
                    key={client._id}
                    value={`client ${client.company} ${client.name} ${client.slug}`}
                    onSelect={() =>
                      run(() =>
                        window.open(
                          `https://${client.slug}.${process.env.NEXT_PUBLIC_ROOT_DOMAIN}`,
                          '_blank',
                          'noopener',
                        ),
                      )
                    }
                  >
                    <ExternalLink className="h-4 w-4" />
                    {client.company || client.name}
                    <CommandShortcut>{client.slug}</CommandShortcut>
                  </CommandItem>
                ))}
            </CommandGroup>
          </>
        )}

        {workspaces && workspaces.length > 1 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Switch workspace">
              {workspaces
                .filter((workspace) => !workspace.isActive)
                .map((workspace) => (
                  <CommandItem
                    key={workspace.id}
                    value={`workspace ${workspace.name}`}
                    onSelect={() => moveWorkspace(workspace.id, workspace.name)}
                  >
                    <Users className="h-4 w-4" />
                    {workspace.name}
                    <CommandShortcut>{workspace.role}</CommandShortcut>
                  </CommandItem>
                ))}
            </CommandGroup>
          </>
        )}

        <CommandSeparator />
        <CommandGroup heading="Theme">
          <CommandItem onSelect={() => run(() => setTheme('light'))}>
            <Sun className="h-4 w-4" />
            Light
          </CommandItem>
          <CommandItem onSelect={() => run(() => setTheme('dark'))}>
            <Moon className="h-4 w-4" />
            Dark
          </CommandItem>
          <CommandItem onSelect={() => run(() => setTheme('system'))}>
            <Monitor className="h-4 w-4" />
            System
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
