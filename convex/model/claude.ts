// One place that talks to the Anthropic API from Convex. Web search runs on
// Anthropic's side: the model searches, reads and answers within one request.

const ENDPOINT = 'https://api.anthropic.com/v1/messages'

type Part = { type: string; text?: string; [key: string]: unknown }
interface Reply {
  content?: Part[]
  stop_reason?: string
  error?: { message?: string }
}

export interface ClaudeArgs {
  system: string
  user: string
  maxTokens?: number
  /** Kept for callers. Newer models reject the parameter, so it is not sent. */
  temperature?: number
  /** Allow this many web searches. Zero or absent means none. */
  searches?: number
}

export function blogModel(): string {
  return process.env.BLOG_AI_MODEL ?? 'claude-sonnet-5-5'
}

export async function callClaude(args: ClaudeArgs): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY is not set on Convex')

  const messages: { role: 'user' | 'assistant'; content: string | Part[] }[] = [{ role: 'user', content: args.user }]
  const collected: string[] = []

  // A search turn can pause and ask to be continued. Allow a few continuations.
  for (let turn = 0; turn < 5; turn++) {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: blogModel(),
        max_tokens: args.maxTokens ?? 6000,
        system: args.system,
        messages,
        ...(args.searches ? { tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: args.searches }] } : {}),
      }),
      signal: AbortSignal.timeout(240_000),
    })
    const data = (await response.json().catch(() => ({}))) as Reply
    if (!response.ok) throw new Error(`Model request failed (${response.status}): ${data.error?.message ?? 'no detail'}`)

    const parts = data.content ?? []
    collected.push(parts.filter((part) => part.type === 'text').map((part) => part.text ?? '').join(''))
    if (data.stop_reason !== 'pause_turn') break
    messages.push({ role: 'assistant', content: parts })
  }
  return collected.join('')
}
