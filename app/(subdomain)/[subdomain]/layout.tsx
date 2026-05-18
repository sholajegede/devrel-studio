import React from "react"
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Performance Dashboard | DevRel Studio',
  description: 'Monthly content deliverables report for retained client',
}

export default function PerformanceDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
