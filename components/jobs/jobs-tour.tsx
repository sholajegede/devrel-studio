'use client'

import { useRef } from 'react'
import { AdminTour, AdminTourTriggerButton, type TourVariant } from '@/components/admin-onboarding-tour'
import { useTourGate } from '@/components/jobs/use-tour-gate'
import type { TourId } from '@/lib/tour-memory'

/**
 * The job board tour. It starts by itself until it has been finished, or has
 * run three times, on any of: this browser, this account, this network.
 * The Tour button always starts it.
 */
export function JobsTour({ variant }: { variant: Extract<TourVariant, TourId> }) {
  const gate = useTourGate(variant)
  const start = useRef<(() => void) | null>(null)
  return (
    <>
      <AdminTour
        variant={variant}
        autoStart
        gate={gate}
        onTourControlReady={(controls) => {
          start.current = controls.startTour
        }}
      />
      <span data-tour="jobs-help">
        <AdminTourTriggerButton onStartTour={() => start.current?.()} />
      </span>
    </>
  )
}
