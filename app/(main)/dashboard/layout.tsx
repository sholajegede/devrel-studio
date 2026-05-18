"use client";

import { UserProvider } from "@/contexts/user-context";
import { DashboardSidebar } from "@/components/dashboard/sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <UserProvider>
      <DashboardSidebar />
      <div className="min-h-screen bg-background lg:pl-60 pt-14 lg:pt-0">
        {children}
      </div>
    </UserProvider>
  );
}
