import 'server-only'
import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server'

/**
 * Whether the visitor is signed in, for server components.
 *
 * Kinde types `getKindeServerSession()` as nullable and the check itself can
 * throw when there is no request context — neither of which should ever take a
 * marketing page down. Any failure resolves to "not signed in", which is the
 * safe reading: the worst outcome is showing a sign-in button to someone who is
 * already signed in.
 */
export async function isSignedIn(): Promise<boolean> {
  try {
    const session = getKindeServerSession()
    return (await session?.isAuthenticated?.()) === true
  } catch {
    return false
  }
}
