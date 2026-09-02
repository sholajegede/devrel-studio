import { describe, expect, it } from 'vitest'
import {
  ADMIN_SUBDOMAIN,
  HANDLE_PATTERN,
  adminHostFor,
  isAdminHost,
  isReservedHandle,
  isReservedSubdomain,
  normalizeHandle,
  normalizeSlug,
} from '@/lib/naming'

describe('normalizeSlug', () => {
  it('lowercases and hyphenates', () => {
    expect(normalizeSlug('Acme Corp')).toBe('acme-corp')
    expect(normalizeSlug('  Kinde  ')).toBe('kinde')
  })

  it('collapses runs of separators rather than leaving doubles', () => {
    expect(normalizeSlug('Acme   Corp')).toBe('acme-corp')
    expect(normalizeSlug('acme--corp')).toBe('acme-corp')
    expect(normalizeSlug('a - b - c')).toBe('a-b-c')
  })

  it('strips characters that are not valid in a hostname', () => {
    expect(normalizeSlug('Acme, Inc.')).toBe('acme-inc')
    expect(normalizeSlug('café')).toBe('caf')
    expect(normalizeSlug('a_b')).toBe('ab')
  })

  it('never leaves a leading or trailing hyphen', () => {
    // A hostname label cannot start or end with a hyphen, so these would
    // produce a slug that can be stored but never resolved.
    expect(normalizeSlug('-acme-')).toBe('acme')
    expect(normalizeSlug('.acme.')).toBe('acme')
    expect(normalizeSlug('   -  acme  -   ')).toBe('acme')
  })

  it('returns empty string when nothing usable survives', () => {
    expect(normalizeSlug('')).toBe('')
    expect(normalizeSlug('   ')).toBe('')
    expect(normalizeSlug('!!!')).toBe('')
    expect(normalizeSlug('---')).toBe('')
  })

  it('is idempotent', () => {
    for (const input of ['Acme Corp', '-acme-', 'a  b', 'Café Ltd.']) {
      expect(normalizeSlug(normalizeSlug(input))).toBe(normalizeSlug(input))
    }
  })
})

describe('normalizeHandle', () => {
  it('drops a leading @ and lowercases', () => {
    expect(normalizeHandle('@Shola')).toBe('shola')
    expect(normalizeHandle('  @SHOLA ')).toBe('shola')
  })

  it('only strips the first @', () => {
    expect(normalizeHandle('@@shola')).toBe('@shola')
  })

  it('leaves underscores alone, unlike slugs', () => {
    expect(normalizeHandle('shola_j')).toBe('shola_j')
    expect(normalizeSlug('shola_j')).toBe('sholaj')
  })
})

describe('HANDLE_PATTERN', () => {
  it('accepts handles of 3 to 30 characters', () => {
    expect(HANDLE_PATTERN.test('abc')).toBe(true)
    expect(HANDLE_PATTERN.test('a'.repeat(30))).toBe(true)
    expect(HANDLE_PATTERN.test('shola-j_1')).toBe(true)
  })

  it('rejects handles that are too short or too long', () => {
    expect(HANDLE_PATTERN.test('ab')).toBe(false)
    expect(HANDLE_PATTERN.test('a'.repeat(31))).toBe(false)
  })

  it('requires alphanumeric first and last characters', () => {
    expect(HANDLE_PATTERN.test('-shola')).toBe(false)
    expect(HANDLE_PATTERN.test('shola-')).toBe(false)
    expect(HANDLE_PATTERN.test('_shola')).toBe(false)
  })

  it('rejects uppercase, so callers must normalize first', () => {
    expect(HANDLE_PATTERN.test('Shola')).toBe(false)
    expect(HANDLE_PATTERN.test(normalizeHandle('@Shola'))).toBe(true)
  })
})

describe('reserved names', () => {
  it('reserves hostnames that must keep resolving to the apex app', () => {
    for (const name of ['www', 'app', 'api', 'admin', 'dashboard', 'invite']) {
      expect(isReservedSubdomain(name)).toBe(true)
    }
  })

  it('allows ordinary client names', () => {
    for (const name of ['kinde', 'convex', 'acme-corp', 'clerk']) {
      expect(isReservedSubdomain(name)).toBe(false)
    }
  })

  it('is case and whitespace insensitive', () => {
    expect(isReservedSubdomain(' WWW ')).toBe(true)
    expect(isReservedHandle('Admin')).toBe(true)
  })

  it('reserves every subdomain as a handle too', () => {
    // The handle list is a superset. If it ever stops being one, a name could be
    // claimable as a handle while being unroutable as a subdomain.
    for (const name of ['www', 'app', 'api', 'staging', 'portfolio']) {
      expect(isReservedSubdomain(name)).toBe(true)
      expect(isReservedHandle(name)).toBe(true)
    }
  })

  it('reserves top-level route names as handles', () => {
    for (const name of ['me', 'new', 'terms', 'privacy']) {
      expect(isReservedHandle(name)).toBe(true)
    }
  })
})

// ── The admin host ────────────────────────────────────────────────────────────
//
// The console answers on its own origin. These pin the two facts the routing
// depends on: which hosts are the console, and which are emphatically not.

describe('isAdminHost', () => {
  it('recognises the console in production and in development', () => {
    expect(isAdminHost('admin.devrel.studio')).toBe(true)
    expect(isAdminHost('admin.localhost:3000')).toBe(true)
  })

  it('is not the product host', () => {
    expect(isAdminHost('devrel.studio')).toBe(false)
    expect(isAdminHost('www.devrel.studio')).toBe(false)
    expect(isAdminHost('localhost:3000')).toBe(false)
  })

  it('is not a client dashboard that merely starts with the letters', () => {
    // administrator.devrel.studio is a slug somebody could have claimed.
    expect(isAdminHost('administrator.devrel.studio')).toBe(false)
    expect(isAdminHost('admin-tools.devrel.studio')).toBe(false)
  })

  it('cannot be claimed as a client slug', () => {
    // The whole arrangement rests on this: the console took an address that was
    // already reserved, so no existing dashboard could be shadowed by it.
    expect(isReservedSubdomain(ADMIN_SUBDOMAIN)).toBe(true)
  })
})

describe('adminHostFor', () => {
  it('derives the console host from whichever host is being served', () => {
    // Derived rather than configured, so a preview deployment redirects to its
    // own console rather than to production's.
    expect(adminHostFor('devrel.studio')).toBe('admin.devrel.studio')
    expect(adminHostFor('www.devrel.studio')).toBe('admin.devrel.studio')
    expect(adminHostFor('localhost:3000')).toBe('admin.localhost')
  })
})
