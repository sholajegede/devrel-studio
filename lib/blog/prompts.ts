// The instructions the blog writer, researcher and fact-checker work from.
// The house standard is Simplified Technical English adapted for developer
// articles, in an engineering-blog voice, with the avoid-AI-writing rules.

export const PRODUCT_FACTS = `DevRel Studio (devrel.studio) is a product for people who work in developer relations.
- The job board at /jobs lists DevRel, developer advocacy, developer success, community, docs and developer education roles. It is free. It reads company career pages three times a day and removes roles that are no longer listed.
- Each role shows pay (in US dollars a year when the listing gives it), whether the role is open in the reader's country, and the level.
- A free account adds CV matching, a tracker for applications, email alerts, and a pay and hiring view. Jobs Pro adds AI-tailored CV bullets and cover notes, more alerts and instant alerts.
- Content tracking: advocates log the articles, talks, videos, events and code they ship. Clients get a live dashboard of that work. Each advocate gets a public portfolio.
Do not claim any other feature. Do not quote prices.`

export const VOICE_RULES = `VOICE: an engineering blog (the plain, specific style of the Cloudflare, GitHub and Netflix engineering blogs), written by one person who does this work.
STANDARD (Simplified Technical English, adapted for developer articles):
- Active voice. Name who or what does each action.
- Sentences of about 20 words or fewer. One idea per sentence. Short sentences of 8 words or fewer should be rare (under 8% of sentences).
- Connected, flowing prose. Sentences lead into each other. Do not write a string of blunt standalone facts.
- Plain words. Use "make sure" not "ensure" or "verify". Use "use" not "utilize". Use "show" not "demonstrate". Use "so" not "thus". Use "also" not "additionally".
- Same thing, same word, every time. Do not vary a term for style.
- No noun cluster longer than three words.
- Define each term the first time it appears, in plain words.
- Product and technical names are fine. Keep the words around them plain.
- Em dashes: at most 4 in the whole post. Prefer commas and full stops.
- Never tell the reader what they think or feel ("you might think", "don't worry", "you may be wondering").
- No invented scenes, times, names or details. If a detail is not in the facts you were given, leave it out.
- No stacked one-line aphorisms at the end of paragraphs. No closing line that sums up the post with a flourish.
- No "not just X but Y" or "it's not about X, it's about Y". No rhetorical questions as transitions. No "In today's ...". No "Let's dive in". No "game-changer", "landscape", "leverage", "robust", "seamless", "unlock", "delve", "comprehensive", "crucial".
- Numbers: use only numbers that appear in the FACTS or DATA you were given.
- Write for a developer advocate, a developer relations manager or someone moving into the field.`

export const POST_FORMAT = `FORMAT (for search and for AI answer engines):
1. TITLE: a direct "How to ...", "Why ..." or "What ..." title, 8 to 14 words, under 80 characters, with the main search words first. No "-ing" opening word. No clever headline. No part numbers.
2. The body starts with one bold sentence that states the answer or finding, then a short paragraph that begins "**Quick answer:**" and gives the full conclusion in 40 to 60 words. Nothing comes before these.
3. Then 4 to 6 sections, each with a "## " heading. Phrase at least three headings as the question a reader would type into a search box. Each section opens with its answer, then the detail.
4. One section near the end is called "Limits" or "Where this does not apply". It holds every caveat, so the other sections stay clean.
5. Include one or two diagrams as inline SVG in a fenced block that starts with three backticks and the word svg. After the block, add one line in italics as the caption, like *Figure: what the diagram shows.* Use the rules for SVG below.
6. Use code blocks only where code is the thing being described. Use a table only for a real comparison.
7. Mention DevRel Studio at most twice in the body, only where it is the honest answer to a point in the text, with a link such as [the DevRel Studio job board](/jobs) or [DevRel Studio](/). State what it does in plain words. Do not write a sales paragraph. A post with no natural place for it mentions it once, at the end of the "Limits" section or in the last short section.
8. Length: 1000 to 1500 words in the body.
SVG RULES: one <svg> element with viewBox="0 0 720 360" and role="img" and an aria-label. Use only rect, circle, ellipse, line, polyline, polygon, path, text, g, defs and marker. Put fill and stroke as attributes. Use fill="none" stroke="currentColor" for lines and boxes, and fill="currentColor" for text, so it works in light and dark mode. Font size 14 to 16. Keep text short. No style attribute. No links. No images.`

export const OUTPUT_SHAPE = `Return exactly this layout and nothing else:
TITLE: <title>
DESCRIPTION: <one sentence, 120 to 155 characters, plain, no quotation marks>
KEYWORD: <the main search phrase, 2 to 5 words>
SLUG: <lowercase words joined by hyphens, 3 to 8 words>
---BODY---
<the article in Markdown>
---FAQ---
Q: <question a reader would search for>
A: <answer in 30 to 60 words, complete without the article>
Q: ...
A: ...
(3 to 5 questions)`

export function topicPrompt(args: {
  candidates: string
  dataBlock: string
  written: string
  today: string
}): { system: string; user: string } {
  return {
    system: `You choose the next article for the DevRel Studio blog. The readers are developer advocates, DevRel managers and people moving into developer relations. The blog helps them find work, do the work well, and show its value.
Pick one topic that a reader would search for, that has a clear answer, and that DevRel Studio can speak about with real knowledge. Prefer a topic with a reason to be read this week. Never pick a topic that overlaps a post already written. Return JSON only.`,
    user: `Today: ${args.today}

POSTS ALREADY WRITTEN (do not repeat or closely overlap):
${args.written || '(none yet)'}

CANDIDATES (recent discussion and standing subjects):
${args.candidates}

DATA FROM THE DEVREL STUDIO JOB BOARD (real, can support a data-led post):
${args.dataBlock}

Return JSON with these keys: {"title": string, "keyword": string, "angle": string (two sentences: what the post says that others do not), "reader": string, "why_now": string, "kind": "news" | "data" | "evergreen", "search_questions": string[] (3 to 5 real search questions), "source_urls": string[] (from the candidates, may be empty)}`,
  }
}

export function researchPrompt(topic: { title: string; angle: string; keyword: string; searchQuestions: string[] }): { system: string; user: string } {
  return {
    system: `You research one topic for a technical article. Use web search. Collect facts a careful writer can cite: what happened, numbers with their source and date, how a product really works. Prefer primary sources: official docs, company posts, the data owner. Drop anything you cannot trace to a page you read. Return JSON only.`,
    user: `Topic: ${topic.title}
Angle: ${topic.angle}
Main search phrase: ${topic.keyword}
Questions readers ask: ${topic.searchQuestions.join(' | ')}

Return {"facts": [{"claim": string, "source_url": string, "source_title": string, "date": string}], "gaps": string[]}. Give 8 to 16 facts. "gaps" lists what you could not confirm.`,
  }
}

export function writerSystem(): string {
  return `You write one article for the DevRel Studio blog.

${VOICE_RULES}

${POST_FORMAT}

GROUNDING:
- Use only the FACTS, the job board DATA and the PRODUCT FACTS in the message. Do not add any fact, number, date, quote or product behaviour from memory.
- When a fact needs a source, link the source name in the sentence using its URL from the FACTS.
- Opinion and advice are fine when they follow from the facts. Label them as your view with "I" only when the post is written from practice. If there is no real practice behind it, write advice as plain instruction.
- If the facts are thin on a point, say less. A shorter correct post is better than a longer guess.

${OUTPUT_SHAPE}`
}

export function writerUser(args: {
  title: string
  angle: string
  keyword: string
  reader: string
  searchQuestions: string[]
  facts: string
  dataBlock: string
}): string {
  return `ARTICLE BRIEF
Working title: ${args.title}
Main search phrase: ${args.keyword}
Reader: ${args.reader}
Angle: ${args.angle}
Questions to answer: ${args.searchQuestions.join(' | ')}

FACTS (with sources):
${args.facts}

DATA FROM THE DEVREL STUDIO JOB BOARD:
${args.dataBlock}

PRODUCT FACTS:
${PRODUCT_FACTS}`
}

export function repairUser(draft: string, problems: string[]): string {
  return `Here is the draft. Fix every problem listed. Keep the facts and sources. Keep the same layout. Change only what is needed.

PROBLEMS:
${problems.map((problem) => `- ${problem}`).join('\n')}

DRAFT:
${draft}`
}

export const FACT_CHECK_SYSTEM = `You fact-check a technical article before it is published. Use web search.
1. List every checkable claim: numbers, dates, names of products and companies, what a product does, who said what, statistics, prices, and any statement about how something works.
2. Check each claim against a source you open. Prefer primary sources.
3. Give a verdict for each: "verified" (a source confirms it), "unsupported" (you found no source either way), or "wrong" (a source contradicts it or the detail is out of date).
4. Claims about DevRel Studio itself are checked against the PRODUCT FACTS and DATA in the message, not the web.
Return JSON only: {"claims": [{"claim": string, "verdict": "verified" | "unsupported" | "wrong", "source_url": string, "note": string (one short sentence; for wrong, say what is right)}]}.
Be strict. Do not mark a claim verified from memory.`

export function factCheckUser(args: { body: string; dataBlock: string }): string {
  return `PRODUCT FACTS:
${PRODUCT_FACTS}

DATA FROM THE DEVREL STUDIO JOB BOARD:
${args.dataBlock}

ARTICLE:
${args.body}`
}

export function factRepairUser(draft: string, flagged: { claim: string; verdict: string; note: string }[]): string {
  return `These claims in the draft failed a fact check. For each one: fix it using the correct fact in the note, or cut the sentence if you cannot fix it without guessing. Do not add new claims. Keep the layout and everything else as it is.

FLAGGED CLAIMS:
${flagged.map((item) => `- [${item.verdict}] ${item.claim} :: ${item.note}`).join('\n')}

DRAFT:
${draft}`
}
