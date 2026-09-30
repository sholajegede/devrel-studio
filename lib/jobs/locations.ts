export type RegionId =
  | 'north-america'
  | 'latin-america'
  | 'europe'
  | 'middle-east'
  | 'africa'
  | 'asia-pacific'

export const REGIONS: { id: RegionId; label: string }[] = [
  { id: 'north-america', label: 'North America' },
  { id: 'latin-america', label: 'Latin America' },
  { id: 'europe', label: 'Europe' },
  { id: 'middle-east', label: 'Middle East' },
  { id: 'africa', label: 'Africa' },
  { id: 'asia-pacific', label: 'Asia-Pacific' },
]

export type Workplace = 'remote' | 'hybrid' | 'onsite' | 'unknown'
export type RemoteScope = 'worldwide' | 'regional' | 'country' | 'unspecified'

interface Country {
  code: string
  name: string
  region: RegionId
  aliases?: string[]
}

const COUNTRIES: Country[] = [
  { code: 'US', name: 'United States', region: 'north-america', aliases: ['usa', 'u.s.', 'u.s.a.'] },
  { code: 'CA', name: 'Canada', region: 'north-america' },
  { code: 'MX', name: 'Mexico', region: 'latin-america' },
  { code: 'BR', name: 'Brazil', region: 'latin-america' },
  { code: 'AR', name: 'Argentina', region: 'latin-america' },
  { code: 'CO', name: 'Colombia', region: 'latin-america' },
  { code: 'CL', name: 'Chile', region: 'latin-america' },
  { code: 'PE', name: 'Peru', region: 'latin-america' },
  { code: 'GB', name: 'United Kingdom', region: 'europe', aliases: ['uk', 'u.k.', 'england', 'scotland', 'wales', 'great britain'] },
  { code: 'IE', name: 'Ireland', region: 'europe' },
  { code: 'DE', name: 'Germany', region: 'europe' },
  { code: 'FR', name: 'France', region: 'europe' },
  { code: 'ES', name: 'Spain', region: 'europe' },
  { code: 'PT', name: 'Portugal', region: 'europe' },
  { code: 'IT', name: 'Italy', region: 'europe' },
  { code: 'NL', name: 'Netherlands', region: 'europe', aliases: ['the netherlands'] },
  { code: 'BE', name: 'Belgium', region: 'europe' },
  { code: 'CH', name: 'Switzerland', region: 'europe' },
  { code: 'AT', name: 'Austria', region: 'europe' },
  { code: 'SE', name: 'Sweden', region: 'europe' },
  { code: 'NO', name: 'Norway', region: 'europe' },
  { code: 'DK', name: 'Denmark', region: 'europe' },
  { code: 'FI', name: 'Finland', region: 'europe' },
  { code: 'PL', name: 'Poland', region: 'europe' },
  { code: 'CZ', name: 'Czech Republic', region: 'europe', aliases: ['czechia'] },
  { code: 'RO', name: 'Romania', region: 'europe' },
  { code: 'UA', name: 'Ukraine', region: 'europe' },
  { code: 'TR', name: 'Turkey', region: 'middle-east', aliases: ['türkiye', 'turkiye'] },
  { code: 'IL', name: 'Israel', region: 'middle-east' },
  { code: 'AE', name: 'United Arab Emirates', region: 'middle-east', aliases: ['uae', 'dubai', 'abu dhabi'] },
  { code: 'SA', name: 'Saudi Arabia', region: 'middle-east' },
  { code: 'EG', name: 'Egypt', region: 'africa' },
  { code: 'NG', name: 'Nigeria', region: 'africa' },
  { code: 'KE', name: 'Kenya', region: 'africa' },
  { code: 'ZA', name: 'South Africa', region: 'africa' },
  { code: 'GH', name: 'Ghana', region: 'africa' },
  { code: 'IN', name: 'India', region: 'asia-pacific' },
  { code: 'SG', name: 'Singapore', region: 'asia-pacific' },
  { code: 'JP', name: 'Japan', region: 'asia-pacific' },
  { code: 'KR', name: 'South Korea', region: 'asia-pacific', aliases: ['korea'] },
  { code: 'CN', name: 'China', region: 'asia-pacific' },
  { code: 'HK', name: 'Hong Kong', region: 'asia-pacific' },
  { code: 'AU', name: 'Australia', region: 'asia-pacific' },
  { code: 'NZ', name: 'New Zealand', region: 'asia-pacific' },
  { code: 'ID', name: 'Indonesia', region: 'asia-pacific' },
  { code: 'PH', name: 'Philippines', region: 'asia-pacific' },
  { code: 'VN', name: 'Vietnam', region: 'asia-pacific' },
]

const CITIES: Record<string, string> = {
  'san francisco': 'US', 'new york': 'US', nyc: 'US', seattle: 'US', austin: 'US', boston: 'US',
  chicago: 'US', 'los angeles': 'US', denver: 'US', atlanta: 'US', portland: 'US', 'san mateo': 'US',
  'mountain view': 'US', 'palo alto': 'US', 'santa clara': 'US', 'san jose': 'US', miami: 'US',
  nashville: 'US', brooklyn: 'US', sunnyvale: 'US', 'bay area': 'US',
  toronto: 'CA', vancouver: 'CA', montreal: 'CA', ottawa: 'CA', calgary: 'CA',
  london: 'GB', manchester: 'GB', edinburgh: 'GB', dublin: 'IE',
  berlin: 'DE', munich: 'DE', hamburg: 'DE', paris: 'FR', madrid: 'ES', barcelona: 'ES', lisbon: 'PT',
  amsterdam: 'NL', zurich: 'CH', stockholm: 'SE', copenhagen: 'DK', warsaw: 'PL', krakow: 'PL',
  'tel aviv': 'IL', cairo: 'EG', lagos: 'NG', nairobi: 'KE', 'cape town': 'ZA', johannesburg: 'ZA',
  bengaluru: 'IN', bangalore: 'IN', mumbai: 'IN', delhi: 'IN', hyderabad: 'IN', pune: 'IN',
  tokyo: 'JP', seoul: 'KR', sydney: 'AU', melbourne: 'AU', 'são paulo': 'BR', 'sao paulo': 'BR',
  'mexico city': 'MX', 'buenos aires': 'AR', bogotá: 'CO', bogota: 'CO', zapopan: 'MX',
}

const US_STATES = new Set(
  'AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC'.split(' '),
)
const CA_PROVINCES = new Set('ON BC QC AB MB NS NB SK'.split(' '))

const byCode = new Map(COUNTRIES.map((c) => [c.code, c]))
const byName = new Map<string, Country>()
for (const country of COUNTRIES) {
  byName.set(country.name.toLowerCase(), country)
  for (const alias of country.aliases ?? []) byName.set(alias, country)
}

export function regionOfCountry(code: string): RegionId | null {
  return byCode.get(code)?.region ?? null
}

export function countryName(code: string): string {
  return byCode.get(code)?.name ?? code
}

export const COUNTRY_OPTIONS = COUNTRIES.map((c) => ({ code: c.code, name: c.name })).sort((a, b) =>
  a.name.localeCompare(b.name),
)

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function countriesIn(segment: string): string[] {
  const found = new Set<string>()
  const cleaned = segment.toLowerCase().replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim()

  for (const [name, country] of byName) {
    const pattern = new RegExp(`(^|[^a-z])${escapeRegex(name)}($|[^a-z])`)
    if (pattern.test(cleaned)) found.add(country.code)
  }
  if (/(^|[^a-z])us($|[^a-z])/.test(cleaned) && /\b(US|U\.S\.)\b/.test(segment)) found.add('US')

  for (const [city, code] of Object.entries(CITIES)) {
    if (new RegExp(`(^|[^a-z])${escapeRegex(city)}($|[^a-z])`).test(cleaned)) found.add(code)
  }

  const abbreviations = segment.match(/\b[A-Z]{2}\b/g) ?? []
  for (const abbreviation of abbreviations) {
    const followsComma = new RegExp(`,\\s*${abbreviation}\\b`).test(segment)
    if (followsComma && US_STATES.has(abbreviation)) found.add('US')
    else if (followsComma && CA_PROVINCES.has(abbreviation)) found.add('CA')
  }
  return [...found]
}

const REGION_WORDS: { test: RegExp; regions: RegionId[] }[] = [
  { test: /\bemea\b/i, regions: ['europe', 'middle-east', 'africa'] },
  { test: /\bapac\b|asia.?pacific/i, regions: ['asia-pacific'] },
  { test: /\blatam\b|latin america/i, regions: ['latin-america'] },
  { test: /\bamericas\b/i, regions: ['north-america', 'latin-america'] },
  { test: /north america|\bnam\b/i, regions: ['north-america'] },
  { test: /\beurope\b|\beu\b|\bcet\b/i, regions: ['europe'] },
  { test: /\bafrica\b/i, regions: ['africa'] },
  { test: /middle east|\bmena\b/i, regions: ['middle-east'] },
]

export interface ParsedLocation {
  workplace: Workplace
  label: string
  locations: string[]
  countries: string[]
  regions: RegionId[]
  remoteScope: RemoteScope | null
}

export function parseLocations(
  rawLocations: (string | null | undefined)[],
  hints: { isRemote?: boolean | null; workplaceType?: string | null } = {},
): ParsedLocation {
  const locations = [
    ...new Set(
      rawLocations
        .filter((value): value is string => Boolean(value && value.trim()))
        .flatMap((value) => value.split(/\s*[;|]\s*|\s+\/\s+/))
        .map((value) => value.replace(/\s+/g, ' ').trim())
        .filter(Boolean),
    ),
  ]

  const joined = locations.join(' | ')
  const workplaceHint = (hints.workplaceType ?? '').toLowerCase()

  let workplace: Workplace = 'unknown'
  if (
    workplaceHint.includes('remote') ||
    hints.isRemote ||
    /\bremote\b|work from home|anywhere/i.test(joined)
  ) {
    workplace = 'remote'
  } else if (workplaceHint.includes('hybrid') || /\bhybrid\b/i.test(joined)) {
    workplace = 'hybrid'
  } else if (workplaceHint.includes('on') || locations.length > 0) {
    workplace = 'onsite'
  }

  const countries = new Set<string>()
  for (const location of locations) for (const code of countriesIn(location)) countries.add(code)

  const regions = new Set<RegionId>()
  for (const code of countries) {
    const region = regionOfCountry(code)
    if (region) regions.add(region)
  }

  let remoteScope: RemoteScope | null = null
  if (workplace === 'remote') {
    if (/anywhere|worldwide|world.?wide|global|any location|all locations/i.test(joined)) {
      remoteScope = 'worldwide'
    } else {
      const regional = REGION_WORDS.filter((entry) => entry.test.test(joined))
      if (regional.length > 0) {
        remoteScope = 'regional'
        for (const entry of regional) for (const region of entry.regions) regions.add(region)
      } else if (countries.size > 0) {
        remoteScope = 'country'
      } else {
        remoteScope = 'unspecified'
      }
    }
  }

  const label =
    locations.length === 0
      ? workplace === 'remote'
        ? 'Remote'
        : 'Location not listed'
      : locations.length <= 2
        ? locations.join(' · ')
        : `${locations[0]} +${locations.length - 1} more`

  return {
    workplace,
    label,
    locations,
    countries: [...countries],
    regions: [...regions],
    remoteScope,
  }
}

export type Eligibility = 'yes' | 'local' | 'unknown' | 'no'

export function eligibility(
  job: {
    workplace: Workplace
    remoteScope?: RemoteScope | null
    countries: string[]
    regions: string[]
  },
  country: string,
): Eligibility {
  const region = regionOfCountry(country)
  if (job.workplace === 'remote') {
    switch (job.remoteScope) {
      case 'worldwide':
        return 'yes'
      case 'regional':
        return region && job.regions.includes(region) ? 'yes' : 'no'
      case 'country':
        return job.countries.includes(country) ? 'yes' : 'no'
      default:
        return 'unknown'
    }
  }
  if (job.countries.length === 0) return 'unknown'
  return job.countries.includes(country) ? 'local' : 'no'
}
