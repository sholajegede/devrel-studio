import { describe, expect, it } from 'vitest'
import { CSV_TEMPLATE, parseCsv, parseDate, splitCsvLine } from '@/lib/csv-import'

describe('splitCsvLine', () => {
  it('splits on commas', () => {
    expect(splitCsvLine('a,b,c')).toEqual(['a', 'b', 'c'])
  })

  it('keeps commas inside quotes', () => {
    // Titles contain commas constantly; a naive split corrupts real files.
    expect(splitCsvLine('"Auth, explained",Written')).toEqual(['Auth, explained', 'Written'])
  })

  it('treats a doubled quote as an escaped quote', () => {
    expect(splitCsvLine('"She said ""hello""",x')).toEqual(['She said "hello"', 'x'])
  })

  it('keeps empty fields in position', () => {
    expect(splitCsvLine('a,,c')).toEqual(['a', '', 'c'])
  })
})

describe('parseDate', () => {
  it('accepts ISO', () => {
    expect(parseDate('2026-07-04')).toBe('2026-07-04')
    expect(parseDate('2026-07-04T10:00:00Z')).toBe('2026-07-04')
  })

  it('accepts dates with a named month', () => {
    expect(parseDate('4 July 2026')).toBe('2026-07-04')
    expect(parseDate('July 4, 2026')).toBe('2026-07-04')
  })

  it('refuses ambiguous numeric dates', () => {
    // 03/04/2026 is two different days depending on where you live, and
    // guessing produces a report that is silently wrong.
    expect(parseDate('03/04/2026')).toBeNull()
    expect(parseDate('4/7/26')).toBeNull()
  })

  it('is null for nonsense', () => {
    expect(parseDate('')).toBeNull()
    expect(parseDate(undefined)).toBeNull()
    expect(parseDate('sometime last summer')).toBeNull()
  })
})

describe('parseCsv', () => {
  it('parses the bundled template', () => {
    const result = parseCsv(CSV_TEMPLATE)
    expect(result.errors).toEqual([])
    expect(result.rows).toHaveLength(3)
    expect(result.rows[0].title).toBe('Shipping type-safe webhooks')
    expect(result.rows[0].category).toBe('Written')
    expect(result.rows[0].views).toBe(12480)
  })

  it('accepts columns in any order and any capitalisation', () => {
    const csv = [
      'DATE,Name,Kind',
      '2026-07-04,A post,blog',
    ].join('\n')
    const result = parseCsv(csv)
    expect(result.errors).toEqual([])
    expect(result.rows[0]).toMatchObject({
      title: 'A post',
      category: 'Written',
      publicationDate: '2026-07-04',
    })
  })

  it('maps common synonyms onto real categories', () => {
    const csv = [
      'Title,Category,Date',
      'a,talk,2026-07-01',
      'b,youtube,2026-07-02',
      'c,npm,2026-07-03',
      'd,starter,2026-07-04',
    ].join('\n')
    const result = parseCsv(csv)
    expect(result.rows.map((r) => r.category)).toEqual(['Event', 'Video', 'Package', 'Demo'])
  })

  it('reports bad rows instead of dropping them silently', () => {
    // An import that quietly loses rows is worse than one that fails.
    const csv = [
      'Title,Category,Date',
      'good,Written,2026-07-01',
      ',Written,2026-07-02',
      'no category,,2026-07-03',
      'bad date,Written,03/04/2026',
    ].join('\n')
    const result = parseCsv(csv)

    expect(result.rows).toHaveLength(1)
    expect(result.errors).toHaveLength(3)
    expect(result.errors.map((e) => e.line)).toEqual([3, 4, 5])
    expect(result.errors[0].message).toMatch(/title/i)
    expect(result.errors[2].message).toMatch(/date/i)
  })

  it('numbers line errors as a spreadsheet does', () => {
    const csv = ['Title,Category,Date', 'ok,Written,2026-07-01', 'bad,Nonsense,2026-07-02'].join('\n')
    // Header is line 1, first entry is line 2, so the bad row is line 3.
    expect(parseCsv(csv).errors[0].line).toBe(3)
  })

  it('reads numbers with separators and shorthand', () => {
    const csv = ['Title,Category,Date,Views', 'a,Written,2026-07-01,"12,480"', 'b,Written,2026-07-02,1.2k'].join('\n')
    const result = parseCsv(csv)
    expect(result.rows[0].views).toBe(12480)
    expect(result.rows[1].views).toBe(1200)
  })

  it('splits tags on semicolons, not commas', () => {
    // Commas already separate columns, so tags cannot use them.
    const csv = ['Title,Category,Date,Tags', 'a,Written,2026-07-01,"DX;Auth;SaaS"'].join('\n')
    expect(parseCsv(csv).rows[0].tags).toEqual(['DX', 'Auth', 'SaaS'])
  })

  it('normalises the client into a slug', () => {
    const csv = ['Title,Category,Date,Client', 'a,Written,2026-07-01,Acme Corp'].join('\n')
    expect(parseCsv(csv).rows[0].client).toBe('acme-corp')
  })

  it('defaults an unrecognised status to Draft rather than Published', () => {
    // Guessing "published" would put unfinished work on a client dashboard.
    const csv = ['Title,Category,Date,Status', 'a,Written,2026-07-01,whatever'].join('\n')
    expect(parseCsv(csv).rows[0].status).toBe('Draft')
  })

  it('maps status synonyms', () => {
    const csv = [
      'Title,Category,Date,Status',
      'a,Written,2026-07-01,live',
      'b,Written,2026-07-02,in review',
      'c,Written,2026-07-03,planned',
    ].join('\n')
    expect(parseCsv(csv).rows.map((r) => r.status)).toEqual([
      'Published',
      'Waiting Approval',
      'Scheduled',
    ])
  })

  it('lists columns it did not understand', () => {
    const csv = ['Title,Category,Date,Sentiment,Owner', 'a,Written,2026-07-01,good,me'].join('\n')
    const result = parseCsv(csv)
    expect(result.ignoredColumns).toContain('sentiment')
    expect(result.ignoredColumns).toContain('owner')
    expect(result.rows).toHaveLength(1)
  })

  it('rejects a file with no rows', () => {
    expect(parseCsv('Title,Category,Date').errors[0].message).toMatch(/header row/i)
    expect(parseCsv('').rows).toEqual([])
  })
})
