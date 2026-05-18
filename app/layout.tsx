import React from "react"
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { AppProviders } from "@/providers/ConvexKindeProvider"
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
          <TooltipProvider>
            {children}
            <Analytics />
          </TooltipProvider>
        </body>
      </html>
    </AppProviders>
  )
}