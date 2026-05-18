'use client'

import { useState } from 'react'
import { ContentForm } from '@/components/dashboard/content-form'
import { AdminTour, AdminTourTriggerButton } from '@/components/admin-onboarding-tour'

export default function AddContentPage() {
  const [tourControls, setTourControls] = useState<{ startTour: () => void } | null>(null)

  return (
    <>
      <AdminTour variant="add-entry" autoStart onTourControlReady={setTourControls} />
      <main className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Add New Entry</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Log a new piece of content and its performance metrics
            </p>
          </div>
          {tourControls && (
            <AdminTourTriggerButton onStartTour={tourControls.startTour} />
          )}
        </div>
        <ContentForm />
      </main>
    </>
  )
}
