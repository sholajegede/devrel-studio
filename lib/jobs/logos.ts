// Company logos are looked up by domain. Most boards use the company slug as
// the domain, so only the exceptions are listed. An unknown company simply
// fails to load and the monogram shows instead.

const DOMAINS: Record<string, string> = {
  datadog: 'datadoghq.com',
  'together-ai': 'together.ai',
  'grafana-labs': 'grafana.com',
  'scale-ai': 'scale.com',
  elastic: 'elastic.co',
  'customer-io': 'customer.io',
  honeycomb: 'honeycomb.io',
  cortex: 'cortex.io',
  elevenlabs: 'elevenlabs.io',
  lovable: 'lovable.dev',
  livekit: 'livekit.io',
  perplexity: 'perplexity.ai',
  mastra: 'mastra.ai',
  convex: 'convex.dev',
  runpod: 'runpod.io',
  exa: 'exa.ai',
  chalk: 'chalk.ai',
  factory: 'factory.ai',
  bem: 'bem.ai',
  kernel: 'onkernel.com',
  cuspai: 'cusp.ai',
  'gimlet-labs': 'gimletlabs.ai',
  sierra: 'sierra.ai',
  decagon: 'decagon.ai',
  notion: 'notion.so',
  cursor: 'cursor.com',
  linear: 'linear.app',
  sentry: 'sentry.io',
  llamaindex: 'llamaindex.ai',
  e2b: 'e2b.dev',
  firecrawl: 'firecrawl.dev',
  temporal: 'temporal.io',
  speakeasy: 'speakeasy.com',
  readme: 'readme.com',
  sanity: 'sanity.io',
  baseten: 'baseten.co',
  prefect: 'prefect.io',
  'lightning-ai': 'lightning.ai',
  'trigger-dev': 'trigger.dev',
  cohere: 'cohere.com',
  pinecone: 'pinecone.io',
  weaviate: 'weaviate.io',
  cerebras: 'cerebras.ai',
  kestra: 'kestra.io',
  axiom: 'axiom.co',
  railway: 'railway.com',
  neon: 'neon.com',
}

export function logoDomain(companySlug: string): string {
  return DOMAINS[companySlug] ?? `${companySlug.replace(/-/g, '')}.com`
}

export function logoUrl(companySlug: string, size = 128): string {
  const domain = logoDomain(companySlug)
  const token = process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN
  if (token) return `https://img.logo.dev/${domain}?token=${token}&size=${size}&format=png`
  return `https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${domain}&size=${size}`
}
