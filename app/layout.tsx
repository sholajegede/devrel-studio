import React from "react"
import type { Metadata } from 'next'
import { Hanken_Grotesk, IBM_Plex_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { AppProviders } from "@/providers/ConvexKindeProvider"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
// @ts-ignore TS2307: Cannot find module or type declarations for side-effect import of './globals.css'.
import "./globals.css";

const hanken = Hanken_Grotesk({ subsets: ["latin"], variable: '--font-hanken', display: 'swap' });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ['400', '500'], variable: '--font-plex-mono', display: 'swap' });

export const metadata: Metadata = {
  title: 'DevRel Studio',
  description: 'The workspace for developer advocates: every article, talk and video you ship for a client, with the numbers to prove it worked.',
  generator: 'v0.app',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <AppProviders>
      <html lang="en" suppressHydrationWarning>
        <body className={`${hanken.variable} ${plexMono.variable} font-sans antialiased`}>
            <TooltipProvider>
              {children}
              {/* Every toast.success/error in the app went nowhere without this:
                  the component existed but was never rendered, so 48 call sites
                  across the dashboard gave no feedback at all — successes and
                  failures alike looked identical to nothing happening. */}
              <Toaster richColors closeButton position="top-right" />
              <Analytics />
            </TooltipProvider>
        </body>
      </html>
    </AppProviders>
  )
}