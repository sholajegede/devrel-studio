import { redirect } from 'next/navigation'

/** The console has one section so far; send the bare URL to it. */
export default function AdminIndex() {
  redirect('/admin/requests')
}
