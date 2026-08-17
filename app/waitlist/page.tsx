import { redirect } from 'next/navigation'

/**
 * The waitlist is gone.
 *
 * It existed to collect interest before there was anything to try. There is now
 * a 14-day trial that starts on sign-up, which answers the same question better
 * — a prospect finds out whether the product fits instead of waiting to be let
 * in, and the operator gets a real user instead of an address.
 *
 * A redirect rather than a 404: the URL is already in sent emails and in links
 * people have saved.
 */
export default function WaitlistPage() {
  redirect('/sign-up')
}
