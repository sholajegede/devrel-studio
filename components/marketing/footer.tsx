import Link from 'next/link'
import Image from 'next/image'
import { ExternalLink } from 'lucide-react'

export function MarketingFooter() {
  return (
    <footer className="bg-[#232931] border-t border-white/10 py-12">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2.5 mb-4">
              <Image src="/images/devrel-logo.png" alt="DevRel Studio" width={26} height={26} className="rounded" />
              <span className="text-sm font-semibold text-white">
                devrel<span className="text-white/40">.studio</span>
              </span>
            </Link>
            <p className="text-xs text-white/40 leading-relaxed">
              The command centre for developer advocates who manage content for clients.
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-3">Product</p>
            <ul className="space-y-2">
              {[
                { href: '/#features',     label: 'Features' },
                { href: '/#how-it-works', label: 'How it works' },
                { href: '/#testimonials', label: 'Reviews' },
                { href: '/pricing',       label: 'Pricing' },
              ].map(({ href, label }) => (
                <li key={label}>
                  <Link href={href} className="text-sm text-white/40 hover:text-white transition-colors">{label}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-3">Account</p>
            <ul className="space-y-2">
              {[
                { href: '/dashboard', label: 'Sign in' },
                { href: '/waitlist',  label: 'Join waitlist' },
              ].map(({ href, label }) => (
                <li key={label}>
                  <Link href={href} className="text-sm text-white/40 hover:text-white transition-colors">{label}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-3">Support</p>
            <ul className="space-y-2">
              {[
                { href: 'mailto:hello@devrel.studio', label: 'Email support', external: true },
                { href: '/#faq',                      label: 'FAQ',           external: false },
              ].map(({ href, label, external }) => (
                <li key={label}>
                  <Link href={href} className="text-sm text-white/40 hover:text-white transition-colors inline-flex items-center gap-1">
                    {label}
                    {external && <ExternalLink className="h-3 w-3" />}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-white/30">&copy; {new Date().getFullYear()} DevRel Studio. All rights reserved.</p>
          <p className="text-xs text-white/30">Built for the people who build developer communities.</p>
        </div>
      </div>
    </footer>
  )
}
