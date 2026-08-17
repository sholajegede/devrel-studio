"use client";

import { UserProvider } from "@/contexts/user-context";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { CommandPalette } from "@/components/dashboard/command-palette";
import { ClientScopeProvider } from "@/contexts/client-scope";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <UserProvider>
      <ClientScopeProvider>
      <DashboardSidebar />
      {/* Mounted at the layout so ⌘K works on every dashboard page. It renders
          nothing until opened. */}
      <CommandPalette />
      {/* Seven sidebar links stand between a keyboard user and the page
          content, on every navigation. Visually hidden until focused. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-foreground focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-background"
      >
        Skip to content
      </a>

      <div id="main-content" className="min-h-screen bg-background lg:pl-60 pt-14 lg:pt-0">
        {children}
      </div>
      </ClientScopeProvider>
    </UserProvider>
  );
}
