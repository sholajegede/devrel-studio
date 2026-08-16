import { NextRequest, NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import { generateAccessCode, hashAccessCode } from '@/lib/manager-auth'

export const runtime = 'nodejs'

/**
 * Owner-only management of a client dashboard access code.
 *
 * The code is generated here (server-side, with the secret pepper) and returned
 * exactly once — only its hash is persisted, so it cannot be recovered later.
 * Requests are authenticated to Convex with the caller's Kinde ID token, so the
 * ownership check in `setAccessCode` still applies.
 */
async function authedConvex() {
  const { getIdTokenRaw } = getKindeServerSession()
  const token = await getIdTokenRaw()
  if (!token) return null

  const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL as string)
  client.setAuth(token)
  return client
}

/**
 * Hand the freshly generated code to the Convex mailer. Returns whether it
 * actually went out, so the UI can tell the difference between "emailed" and
 * "copy this yourself" instead of claiming a send that never happened.
 */
async function mailAccessCode(args: {
  convex: ConvexHttpClient
  clientId: Id<'clients'>
  slug: string
  code: string
  emailTo: string
}): Promise<boolean> {
  try {
    const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'localhost:3000'
    const protocol = root.startsWith('localhost') ? 'http' : 'https'

    const result = await args.convex.action(api.email.sendManagerAccessCodePublic, {
      clientId: args.clientId,
      email: args.emailTo,
      code: args.code,
      dashboardUrl: `${protocol}://${args.slug}.${root}`,
    })

    return result.ok
  } catch (error) {
    console.error('[manager-access/code] could not email the code:', error)
    return false
  }
}

/** POST { clientId, slug, emailTo? } — generate (or rotate) the access code. */
export async function POST(req: NextRequest) {
  try {
    const convex = await authedConvex()
    if (!convex) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const { clientId, slug, emailTo } = await req.json()
    if (typeof clientId !== 'string' || typeof slug !== 'string' || !slug) {
      return NextResponse.json({ error: 'Missing clientId or slug' }, { status: 400 })
    }

    const code = generateAccessCode()
    await convex.mutation(api.managerAccess.setAccessCode, {
      clientId: clientId as Id<'clients'>,
      codeHash: hashAccessCode(slug, code),
    })

    // Emailing the code is opt-in per request. It is sent from here rather than
    // from a Convex mutation because this route is the only place the plaintext
    // code exists — Convex stores nothing but its hash, and that should stay
    // true. A failed send must not lose the code, so the response carries it
    // either way and reports whether the mail went out.
    let emailed = false
    if (typeof emailTo === 'string' && emailTo.includes('@')) {
      emailed = await mailAccessCode({
        convex,
        clientId: clientId as Id<'clients'>,
        slug,
        code,
        emailTo,
      })
    }

    // Shown once — there is no way to read it back.
    return NextResponse.json({ ok: true, code, emailed })
  } catch (error) {
    console.error('[manager-access/code] generate failed:', error)
    const message = error instanceof Error ? error.message : 'Something went wrong'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

/** DELETE ?clientId=... — remove the code and sign every manager out. */
export async function DELETE(req: NextRequest) {
  try {
    const convex = await authedConvex()
    if (!convex) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const clientId = req.nextUrl.searchParams.get('clientId')
    if (!clientId) return NextResponse.json({ error: 'Missing clientId' }, { status: 400 })

    await convex.mutation(api.managerAccess.clearAccessCode, {
      clientId: clientId as Id<'clients'>,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[manager-access/code] clear failed:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 400 })
  }
}
