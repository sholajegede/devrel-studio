import type { SourceKind } from './adapters'

export interface SeedSource {
  kind: SourceKind
  slug: string
  name: string
}

const greenhouse: [string, string][] = [
  ['anthropic', 'Anthropic'], ['cockroachlabs', 'Cockroach Labs'], ['datadog', 'Datadog'],
  ['launchdarkly', 'LaunchDarkly'], ['vercel', 'Vercel'], ['togetherai', 'Together AI'],
  ['twilio', 'Twilio'], ['algolia', 'Algolia'], ['grafanalabs', 'Grafana Labs'], ['netlify', 'Netlify'],
  ['neo4j', 'Neo4j'], ['fastly', 'Fastly'], ['gusto', 'Gusto'], ['tailscale', 'Tailscale'],
  ['pagerduty', 'PagerDuty'], ['consensys', 'Consensys'], ['gitlab', 'GitLab'], ['scaleai', 'Scale AI'],
  ['cloudflare', 'Cloudflare'], ['figma', 'Figma'], ['okta', 'Okta'], ['brex', 'Brex'],
  ['elastic', 'Elastic'], ['databricks', 'Databricks'], ['mongodb', 'MongoDB'], ['ripple', 'Ripple'],
  ['stripe', 'Stripe'], ['coinbase', 'Coinbase'], ['asana', 'Asana'], ['braze', 'Braze'],
  ['circleci', 'CircleCI'], ['contentful', 'Contentful'], ['customerio', 'Customer.io'],
  ['descope', 'Descope'], ['fivetran', 'Fivetran'], ['honeycomb', 'Honeycomb'], ['jetbrains', 'JetBrains'],
  ['jfrog', 'JFrog'], ['mixpanel', 'Mixpanel'], ['newrelic', 'New Relic'], ['planetscale', 'PlanetScale'],
  ['sendbird', 'Sendbird'], ['singlestore', 'SingleStore'], ['sumologic', 'Sumo Logic'],
  ['vonage', 'Vonage'], ['webflow', 'Webflow'], ['yugabyte', 'Yugabyte'], ['cribl', 'Cribl'],
  ['cortex', 'Cortex'], ['bitwarden', 'Bitwarden'], ['intercom', 'Intercom'],
]

const ashby: [string, string][] = [
  ['openai', 'OpenAI'], ['supabase', 'Supabase'], ['elevenlabs', 'ElevenLabs'], ['lovable', 'Lovable'],
  ['mintlify', 'Mintlify'], ['livekit', 'LiveKit'], ['perplexity', 'Perplexity'], ['clerk', 'Clerk'],
  ['workos', 'WorkOS'], ['resend', 'Resend'], ['mastra', 'Mastra'], ['convex-dev', 'Convex'],
  ['modal', 'Modal'], ['posthog', 'PostHog'], ['runpod', 'RunPod'], ['exa', 'Exa'], ['chalk', 'Chalk'],
  ['factory', 'Factory'], ['runlayer', 'Runlayer'], ['bem', 'bem'], ['kernel', 'Kernel'], ['cuspai', 'CuspAI'],
  ['gimlet', 'Gimlet Labs'], ['sierra', 'Sierra'], ['decagon', 'Decagon'], ['ramp', 'Ramp'], ['notion', 'Notion'],
  ['cursor', 'Cursor'], ['linear', 'Linear'], ['zapier', 'Zapier'], ['render', 'Render'], ['sentry', 'Sentry'],
  ['llamaindex', 'LlamaIndex'], ['inngest', 'Inngest'], ['browserbase', 'Browserbase'], ['e2b', 'E2B'],
  ['railway', 'Railway'], ['neon', 'Neon'], ['firecrawl', 'Firecrawl'], ['temporal', 'Temporal'],
  ['langchain', 'LangChain'], ['speakeasy', 'Speakeasy'], ['gitbook', 'GitBook'], ['readme', 'ReadMe'],
  ['clickhouse', 'ClickHouse'], ['sanity', 'Sanity'], ['redis', 'Redis'], ['docker', 'Docker'],
  ['plaid', 'Plaid'], ['snowflake', 'Snowflake'], ['baseten', 'Baseten'], ['prefect', 'Prefect'],
  ['nango', 'Nango'], ['anyscale', 'Anyscale'], ['lightning', 'Lightning AI'], ['triggerdev', 'Trigger.dev'],
  ['percona', 'Percona'], ['airbyte', 'Airbyte'], ['amplitude', 'Amplitude'], ['astronomer', 'Astronomer'],
  ['cohere', 'Cohere'], ['confluent', 'Confluent'], ['pinecone', 'Pinecone'], ['weaviate', 'Weaviate'],
  ['snyk', 'Snyk'], ['coder', 'Coder'], ['cerebras', 'Cerebras'], ['kestra', 'Kestra'], ['lancedb', 'LanceDB'],
  ['knock', 'Knock'], ['influxdata', 'InfluxData'], ['checkly', 'Checkly'], ['axiom', 'Axiom'],
]

const lever: [string, string][] = [
  ['palantir', 'Palantir'], ['binance', 'Binance'], ['spotify', 'Spotify'], ['zilliz', 'Zilliz'],
  ['sysdig', 'Sysdig'],
]

// Aggregators carry many employers, and most of the contract work. The name is
// only a label here: each listing brings its own company.
const aggregators: SeedSource[] = [
  { kind: 'remoteok', slug: 'developer-relations', name: 'RemoteOK' },
  { kind: 'remoteok', slug: 'developer-advocate', name: 'RemoteOK advocates' },
  { kind: 'remoteok', slug: 'technical-writer', name: 'RemoteOK writers' },
  { kind: 'wwr', slug: 'all', name: 'We Work Remotely' },
  { kind: 'wwr', slug: 'remote-customer-support-jobs', name: 'We Work Remotely support' },
  { kind: 'hn', slug: 'hiring', name: 'Hacker News: Who is hiring' },
  { kind: 'hn', slug: 'freelancer', name: 'Hacker News: Freelancer' },
]

export const SEED_SOURCES: SeedSource[] = [
  ...aggregators,
  ...greenhouse.map(([slug, name]) => ({ kind: 'greenhouse' as const, slug, name })),
  ...ashby.map(([slug, name]) => ({ kind: 'ashby' as const, slug, name })),
  ...lever.map(([slug, name]) => ({ kind: 'lever' as const, slug, name })),
]
