interface Skill {
  name: string
  pattern?: string
  topic?: string
}

const SKILLS: Skill[] = [
  { name: 'TypeScript' }, { name: 'JavaScript' }, { name: 'Python' }, { name: 'Go', pattern: '\\bgolang\\b|\\bgo (?:language|programming)\\b|\\(go\\)|\\bgo,' },
  { name: 'Rust' }, { name: 'Java', pattern: '\\bjava\\b(?!script)' }, { name: 'Kotlin' }, { name: 'Swift' },
  { name: 'C++', pattern: 'c\\+\\+' }, { name: 'C#', pattern: 'c#' }, { name: '.NET', pattern: '\\.net\\b' },
  { name: 'Ruby' }, { name: 'PHP' }, { name: 'Elixir' }, { name: 'Solidity', topic: 'Web3' },
  { name: 'React' }, { name: 'Next.js', pattern: 'next\\.?js' }, { name: 'Vue', pattern: '\\bvue(?:\\.?js)?\\b' },
  { name: 'Svelte' }, { name: 'Node.js', pattern: 'node\\.?js' }, { name: 'GraphQL' }, { name: 'REST APIs', pattern: '\\brest(?:ful)?\\b|\\bapis?\\b' },
  { name: 'OpenAPI' }, { name: 'SDKs', pattern: '\\bsdks?\\b' }, { name: 'CLI', pattern: '\\bcli\\b|command.line' },
  { name: 'Kubernetes', pattern: 'kubernetes|\\bk8s\\b', topic: 'Cloud & Infra' }, { name: 'Docker', topic: 'Cloud & Infra' },
  { name: 'AWS', topic: 'Cloud & Infra' }, { name: 'GCP', pattern: '\\bgcp\\b|google cloud', topic: 'Cloud & Infra' },
  { name: 'Azure', topic: 'Cloud & Infra' }, { name: 'Terraform', topic: 'Cloud & Infra' },
  { name: 'Serverless', topic: 'Cloud & Infra' }, { name: 'CI/CD', pattern: 'ci/cd|continuous (?:integration|delivery)', topic: 'Cloud & Infra' },
  { name: 'Observability', pattern: 'observability|\\bopentelemetry\\b|\\botel\\b|\\bapm\\b', topic: 'Cloud & Infra' },
  { name: 'PostgreSQL', pattern: 'postgres(?:ql)?', topic: 'Data' }, { name: 'MongoDB', topic: 'Data' },
  { name: 'Redis', topic: 'Data' }, { name: 'SQL', pattern: '\\bsql\\b', topic: 'Data' }, { name: 'Kafka', topic: 'Data' },
  { name: 'Vector databases', pattern: 'vector (?:database|db|search)|embeddings?', topic: 'AI' },
  { name: 'Data engineering', pattern: 'data (?:engineering|pipelines?)|\\betl\\b|\\bdbt\\b|\\bspark\\b', topic: 'Data' },
  { name: 'LLMs', pattern: '\\bllms?\\b|large language models?|generative ai|\\bgenai\\b', topic: 'AI' },
  { name: 'AI agents', pattern: 'ai agents?|agentic|\\bagents?\\b', topic: 'AI' },
  { name: 'RAG', pattern: '\\brag\\b|retrieval.augmented', topic: 'AI' },
  { name: 'MCP', pattern: '\\bmcp\\b|model context protocol', topic: 'AI' },
  { name: 'Machine learning', pattern: 'machine learning|\\bml\\b|deep learning|\\bpytorch\\b|tensorflow', topic: 'AI' },
  { name: 'Prompt engineering', pattern: 'prompt engineering|prompting', topic: 'AI' },
  { name: 'Authentication', pattern: '\\bauth(?:entication|orization)?\\b|\\boauth\\b|\\boidc\\b|\\bsso\\b|identity', topic: 'Security' },
  { name: 'Security', pattern: 'appsec|application security|cybersecurity|\\bsecurity\\b', topic: 'Security' },
  { name: 'Blockchain', pattern: 'blockchain|\\bweb3\\b|\\bdefi\\b|smart contracts?|\\bevm\\b|\\bsolana\\b|ethereum', topic: 'Web3' },
  { name: 'Open source', pattern: 'open.?source|\\boss\\b', topic: 'Community' },
  { name: 'Technical writing', pattern: 'technical writing|documentation|\\bdocs\\b', topic: 'Content' },
  { name: 'Video', pattern: 'video (?:content|production|tutorials?)|youtube|livestream|screencasts?', topic: 'Content' },
  { name: 'Public speaking', pattern: 'public speaking|conference (?:talks?|speaking)|keynotes?|speaker|speaking', topic: 'Community' },
  { name: 'Workshops', pattern: 'workshops?|hackathons?|meetups?', topic: 'Community' },
  { name: 'Community building', pattern: 'community (?:building|management|engagement)|\\bdiscord\\b|\\bslack community\\b', topic: 'Community' },
  { name: 'Developer marketing', pattern: 'developer marketing|dev marketing|growth marketing', topic: 'Marketing' },
  { name: 'SEO', pattern: '\\bseo\\b|search engine optimi[sz]ation' , topic: 'Marketing' },
  { name: 'Sample apps', pattern: 'sample apps?|demo apps?|reference (?:apps?|implementations?)|tutorials?|quickstarts?' },
  { name: 'Mobile', pattern: '\\bios\\b|\\bandroid\\b|react native|\\bflutter\\b|mobile development', topic: 'Mobile' },
  { name: 'Frontend', pattern: 'front.?end|\\bcss\\b|\\bhtml\\b|web development' },
  { name: 'DevOps', pattern: 'devops|\\bsre\\b|platform engineering', topic: 'Cloud & Infra' },
  { name: 'Analytics', pattern: 'analytics|product metrics|\\bkpis?\\b' },
]

const COMPILED = SKILLS.map((skill) => ({
  skill,
  regex: new RegExp(
    skill.pattern ?? `(?<![a-z0-9])${skill.name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![a-z0-9])`,
    'i',
  ),
}))

export const SKILL_NAMES = SKILLS.map((skill) => skill.name)

export function extractSkills(text: string): { skills: string[]; topics: string[] } {
  const sample = text.slice(0, 20000)
  const skills: string[] = []
  const topics = new Set<string>()
  for (const { skill, regex } of COMPILED) {
    if (regex.test(sample)) {
      skills.push(skill.name)
      if (skill.topic) topics.add(skill.topic)
    }
  }
  return { skills, topics: [...topics] }
}
