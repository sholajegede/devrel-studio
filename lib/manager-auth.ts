import 'server-only'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

// ── Manager access code crypto ────────────────────────────────────────────────
//
// Codes and session tokens never reach Convex in plaintext. Everything here is
// server-only — importing this from a client component is a build error.

/**
 * Read lazily rather than at module load: the secret is injected at runtime on
 * Vercel, and throwing at import time would fail the build instead of the one
 * request that actually needs it.
 */
function secret(): string {
  const value = process.env.MANAGER_CODE_SECRET
  if (!value) {
    throw new Error(
      'MANAGER_CODE_SECRET is not set. Client dashboard access codes cannot be issued or verified without it.',
    )
  }
  return value
}

/** Cookie name is per-slug so a manager can hold sessions for several clients. */
export function sessionCookieName(slug: string): string {
  return `mgr_session_${slug.replace(/[^a-z0-9-]/gi, '')}`
}

/**
 * Codes are *displayed* as XXXX-XXXX but that dash is decoration. A manager
 * reading one off a Slack message types it with the dash, without it, with a
 * space, or in lower case — all four have to hash the same, so the separator
 * and case are stripped before hashing rather than compared literally.
 */
export function normalizeAccessCode(code: string): string {
  return code.replace(/[^a-z0-9]/gi, '').toUpperCase()
}

/** Salted hash of an access code. Scoped to the slug so a code is not portable. */
export function hashAccessCode(slug: string, code: string): string {
  return createHash('sha256')
    .update(`${slug}:${normalizeAccessCode(code)}:${secret()}`)
    .digest('hex')
}

/**
 * Stable per-client identifier for rate limiting, so Convex never stores a raw
 * IP. Falls back to a shared bucket when the header is absent — stricter than
 * letting an unidentifiable caller skip the throttle entirely.
 */
export function hashClientIp(ip: string | null): string {
  return createHash('sha256').update(`ip:${ip ?? 'unknown'}:${secret()}`).digest('hex')
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(`${token}:${secret()}`).digest('hex')
}

export function generateSessionToken(): string {
  return randomBytes(32).toString('hex')
}

/**
 * Human-friendly access code: 8 chars from an alphabet with no 0/O/1/I, so it
 * survives being read over a call or pasted from Slack.
 */
export function generateAccessCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = randomBytes(8)
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += alphabet[bytes[i] % alphabet.length]
  }
  return `${code.slice(0, 4)}-${code.slice(4)}`
}

// ── Workspace invitations ─────────────────────────────────────────────────────
//
// Same shape as manager sessions: the link carries a raw token, the database
// stores only its hash. Convex mutations have to be deterministic and so cannot
// generate randomness themselves, which is the other reason this lives here.

export function generateInviteToken(): string {
  return randomBytes(24).toString('base64url')
}

export function hashInviteToken(token: string): string {
  return createHash('sha256').update(`invite:${token}:${secret()}`).digest('hex')
}

/** Constant-time compare for two hex digests of equal length. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'hex')
  const bufB = Buffer.from(b, 'hex')
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60
