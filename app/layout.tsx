import React from "react"
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { AppProviders } from "@/providers/ConvexKindeProvider"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
// @ts-ignore TS2307: Cannot find module or type declarations for side-effect import of './globals.css'.
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'DevRel Studio',
  description: 'Track and manage your DevRel and technical writing deliverables',
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
        <body className={`${inter.variable} font-sans antialiased`}>
          {/* `class` rather than the data attribute, because globals.css defines
              the dark variant as `&:is(.dark *)`. Defaults to the OS setting so
              nobody has to find the toggle to get the theme they already use. */}
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <TooltipProvider>
              {children}
              {/* Every toast.success/error in the app went nowhere without this:
                  the component existed but was never rendered, so 48 call sites
                  across the dashboard gave no feedback at all — successes and
                  failures alike looked identical to nothing happening. */}
              <Toaster richColors closeButton position="top-right" />
              <Analytics />
            </TooltipProvider>
          </ThemeProvider>
        </body>
      </html>
    </AppProviders>
  )
}