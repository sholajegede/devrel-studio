'use client'

import { useState } from 'react'
import { useMutation } from 'convex/react'
import { toast } from 'sonner'
import { api } from '@/convex/_generated/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { contactProblems } from '@/lib/hire/talent'

export function ContactForm({ handle, firstName }: { handle: string; firstName: string }) {
  const send = useMutation(api.talent.contact)
  const [form, setForm] = useState({ name: '', email: '', company: '', message: '', website: '' })
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((current) => ({ ...current, [key]: event.target.value }))

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    const problems = contactProblems(form)
    if (problems.length) return toast.error(problems[0])
    setState('sending')
    try {
      await send({ handle, ...form })
      setState('sent')
    } catch (error) {
      setState('idle')
      toast.error(error instanceof Error ? error.message.replace(/^.*Uncaught ConvexError: /, '').split('\n')[0] : 'Could not send')
    }
  }

  if (state === 'sent') {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="font-medium text-foreground">Message sent</p>
        <p className="mt-1 text-sm text-muted-foreground">{firstName} will reply to {form.email}.</p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-border bg-card p-5" id="contact">
      <h2 className="font-medium text-foreground">Contact {firstName}</h2>
      <p className="text-sm text-muted-foreground">Describe the role. The message goes to {firstName} by email, and replies come straight to you.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input placeholder="Your name" value={form.name} onChange={set('name')} autoComplete="name" required />
        <Input placeholder="Company" value={form.company} onChange={set('company')} autoComplete="organization" required />
      </div>
      <Input type="email" placeholder="Work email" value={form.email} onChange={set('email')} autoComplete="email" required />
      <Textarea placeholder="The role, the team, pay range if you can share it, and how to take the next step" rows={5} value={form.message} onChange={set('message')} required />
      {/* Honeypot. Hidden from people, filled in by scripts. */}
      <input tabIndex={-1} autoComplete="off" aria-hidden="true" value={form.website} onChange={set('website')} className="absolute -left-[9999px] h-0 w-0 opacity-0" />
      <Button type="submit" disabled={state === 'sending'} className="bg-accent text-accent-foreground hover:bg-accent/90">
        {state === 'sending' ? 'Sending' : 'Send message'}
      </Button>
    </form>
  )
}
