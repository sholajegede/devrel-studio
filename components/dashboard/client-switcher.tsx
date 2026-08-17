'use client'

import { ALL_CLIENTS, useClientScope } from '@/contexts/client-scope'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Building2, Check, ChevronsUpDown } from 'lucide-react'

/**
 * Which client the dashboard is scoped to.
 *
 * Sits above the navigation because it applies to every page below it — putting
 * it inside a page would imply it only affects that page, which is the problem
 * it exists to solve.
 *
 * Hidden with fewer than two clients. A picker with one option is a control
 * that cannot do anything.
 */
export function ClientSwitcher({ onNavigate }: { onNavigate?: () => void }) {
  const { scope, setScope, clients, isLoading } = useClientScope()

  if (isLoading || clients.length < 2) return null

  const current = clients.find((client) => client.slug === scope)

  return (
    <div className="border-b border-border px-3 py-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted"
          >
            <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate text-sm text-foreground">
              {current?.name ?? 'All clients'}
            </span>
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel className="text-xs">Viewing</DropdownMenuLabel>
          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={() => {
              setScope(ALL_CLIENTS)
              onNavigate?.()
            }}
            className="gap-2 text-sm"
          >
            <span className="min-w-0 flex-1">All clients</span>
            {scope === ALL_CLIENTS && <Check className="h-3.5 w-3.5 shrink-0" />}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {clients.map((client) => (
            <DropdownMenuItem
              key={client.slug}
              onClick={() => {
                setScope(client.slug)
                onNavigate?.()
              }}
              className="gap-2 text-sm"
            >
              <span className="min-w-0 flex-1 truncate">{client.name}</span>
              <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                {client.slug}
              </span>
              {scope === client.slug && <Check className="h-3.5 w-3.5 shrink-0" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
