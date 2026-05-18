'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Check } from 'lucide-react'
import { toast } from 'sonner'
import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { MarketingNav } from '@/components/marketing/nav'
import { MarketingFooter } from '@/components/marketing/footer'

export default function WaitlistPage() {
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    company: '',
    role: '',
    useCase: ''
  })
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.email) {
      toast.error('Email is required')
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (!response.ok) {
        const error = await response.json()
        toast.error(error.message || 'Failed to join waitlist')
        return
      }

      setIsSubmitted(true)
      toast.success('Successfully joined the waitlist!')
    } catch (error) {
      console.error('[v0] Waitlist error:', error)
      toast.error('Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted flex items-center justify-center px-4">
        <Card className="max-w-md w-full border-primary/20">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Check className="w-8 h-8 text-primary" />
              </div>
            </div>
            <CardTitle>Welcome to the waitlist!</CardTitle>
            <CardDescription className="mt-2">
              You're in line to get early access to DevRel Studio.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm font-medium mb-2">What's next?</p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex gap-2">
                  <span>✓</span>
                  <span>We'll email you when your account is ready</span>
                </li>
                <li className="flex gap-2">
                  <span>✓</span>
                  <span>Get access 2-3 weeks before launch</span>
                </li>
                <li className="flex gap-2">
                  <span>✓</span>
                  <span>Get a special founder discount (30% off)</span>
                </li>
              </ul>
            </div>
            <Link href="/">
              <Button className="w-full bg-transparent" variant="outline">Back to Home</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      <MarketingNav />

      {/* Waitlist Form */}
      <section className="max-w-md mx-auto px-4 py-20">
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-2xl">Join the Waitlist</CardTitle>
            <CardDescription>
              Be among the first to try DevRel Studio and get 30% founder discount.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="Jane Doe"
                  value={formData.name}
                  onChange={handleChange}
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="company">Company</Label>
                <Input
                  id="company"
                  name="company"
                  placeholder="Acme Inc"
                  value={formData.company}
                  onChange={handleChange}
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Input
                  id="role"
                  name="role"
                  placeholder="Technical Writer"
                  value={formData.role}
                  onChange={handleChange}
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="useCase">What would you use DevRel Studio for?</Label>
                <textarea
                  id="useCase"
                  name="useCase"
                  placeholder="Describe your use case..."
                  value={formData.useCase}
                  onChange={handleChange}
                  disabled={isLoading}
                  className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  rows={4}
                />
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Joining...' : 'Join Waitlist'}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                We'll use your email to send you updates about DevRel Studio. We'll never spam you.
              </p>
            </form>
          </CardContent>
        </Card>

        {/* Benefits */}
        <div className="grid sm:grid-cols-3 gap-4 mt-12">
          <div className="text-center">
            <div className="text-3xl font-bold text-primary mb-2">30%</div>
            <p className="text-sm text-muted-foreground">Founder Discount</p>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-primary mb-2">Early</div>
            <p className="text-sm text-muted-foreground">2-3 Week Early Access</p>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-primary mb-2">Forever</div>
            <p className="text-sm text-muted-foreground">Lifetime Benefit</p>
          </div>
        </div>
      </section>
      <MarketingFooter />
    </div>
  )
}
