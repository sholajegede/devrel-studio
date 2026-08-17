"use client";

import { UserProvider } from "@/contexts/user-context";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { CommandPalette } from "@/components/dashboard/command-palette";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <UserProvider>
      <DashboardSidebar />
      {/* Mounted at the layout so ⌘K works on every dashboard page. It renders
          nothing until opened. */}
      <CommandPalette />
      <div className="min-h-screen bg-background lg:pl-60 pt-14 lg:pt-0">
        {children}
      </div>
    </UserProvider>
  );
}
