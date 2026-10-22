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
      <div className="rounded-[2rem] bg-green p-8 text-paper">
        <p className="text-2xl font-medium tracking-[-0.03em]">Message sent</p>
        <p className="mt-2 text-[15px] text-paper/85">{firstName} will reply to {form.email}.</p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-[2rem] bg-ochre p-7 text-ink sm:p-9" id="contact">
      <h2 className="text-2xl font-medium tracking-[-0.03em]">Contact {firstName}</h2>
      <p className="text-[15px] text-ink/75">Describe the role. The message goes to {firstName} by email, and replies come straight to you.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input placeholder="Your name" value={form.name} onChange={set('name')} autoComplete="name" required />
        <Input placeholder="Company" value={form.company} onChange={set('company')} autoComplete="organization" required />
      </div>
      <Input type="email" placeholder="Work email" value={form.email} onChange={set('email')} autoComplete="email" required />
      <Textarea placeholder="The role, the team, pay range if you can share it, and how to take the next step" rows={5} value={form.message} onChange={set('message')} required />
      {/* Honeypot. Hidden from people, filled in by scripts. */}
      <input tabIndex={-1} autoComplete="off" aria-hidden="true" value={form.website} onChange={set('website')} className="absolute -left-[9999px] h-0 w-0 opacity-0" />
      <Button type="submit" disabled={state === 'sending'}>
        {state === 'sending' ? 'Sending' : 'Send message'}
      </Button>
    </form>
  )
}
