// The instructions the blog writer, researcher and fact-checker work from.
// The house standard is Simplified Technical English adapted for developer
// articles, in an engineering-blog voice, with the avoid-AI-writing rules.

export const PRODUCT_FACTS = `DevRel Studio (devrel.studio) is a product for people who work in developer relations.
- The job board at /jobs lists DevRel, developer advocacy, developer success, community, docs and developer education roles. It is free. It reads company career pages three times a day and removes roles that are no longer listed.
- Each role shows pay (in US dollars a year when the listing gives it), whether the role is open in the reader's country, and the level.
- A free account adds CV matching, a tracker for applications, email alerts, and a pay and hiring view. Jobs Pro adds AI-tailored CV bullets and cover notes, more alerts and instant alerts.
- Content tracking: advocates log the articles, talks, videos, events and code they ship. Clients get a live dashboard of that work. Each advocate gets a public portfolio.
Do not claim any other feature. Do not quote prices.`

export const VOICE_RULES = `VOICE: the engineering blogs of Netflix, Cloudflare, Meta, Uber and GitHub. A senior engineer explaining a decision to a peer they respect. Calm, specific, candid about tradeoffs. Above all, it reasons: each sentence exists because of the one before it.

BEFORE YOU WRITE, settle three things from the brief:
1. The one hard question the post answers. Write it as one sentence in your head. Every section serves it.
2. The shape: a data piece (a measurement and what it means), a practical guide (steps and a worked example), or an explainer (how a thing works and why).
3. The numbers you may use. Only numbers from FACTS or DATA.

COHESION (the most important rule):
- Every sentence follows from the one before. It answers the question the last sentence raised, or the link is explicit: "but", "so", "because", "that means", "which is why", "even then".
- The end of one sentence becomes the start of the next. Open each paragraph by saying why it comes next.
- Give the reason a reader needs a definition or mechanism before you give it. Never drop a definition in cold.
- Explain results by cause, not just by report: not "advocacy roles pay $180k" alone, but why that figure sits where it does and what it does not show.
- A short verdict sentence closes a line of reasoning the reader has just followed. It never opens one.
- Test each paragraph: remove one sentence. If nothing breaks, the sentences were not connected. Rewrite.
- Never write a string of standalone facts. Never list source after source. Use the two or three outside figures that sharpen the question, and explain why they differ from each other and from yours.

RHYTHM:
- Average sentence about 20 words. Most sentences between 12 and 28 words. Some longer sentences (30 words or more) carry mechanism and cause, at most 15% of the post.
- Few short sentences (6 words or fewer): no more than 8% of the post. Each one closes reasoning the reader just followed.
- Paragraphs of 2 to 5 sentences.

STANDARD (Simplified Technical English, adapted):
- Active voice. Name who or what does each action.
- Plain words. "make sure" not "ensure" or "verify". "use" not "utilize". "show" not "demonstrate". "so" not "thus". "also" not "additionally".
- Same thing, same word, every time. No noun cluster longer than three words.
- Define each term the first time it appears, in plain words, and say why it matters here.
- Product and technical names are fine. Keep the words around them plain.

SPECIFICITY AND CANDOUR:
- Every claim has a number, a named system or a concrete example within two sentences.
- Admit what the data cannot show, what surprised you in it, and one alternative reading you rejected, with the reason.
- Show before and after with units when you report a change.
- Write in "we" for DevRel Studio and its job board ("our board", "we read company career pages three times a day"). Do not write "I". Do not invent personal experience, scenes, names, times or details.
- "You" is allowed in a practical guide when the reader is doing the steps. Never tell the reader what they think or feel.

AVOID (these mark machine writing):
- Words: delve, leverage, harness, robust, seamless, tapestry, landscape, realm, testament, pivotal, crucial, vibrant, foster, cutting-edge, game-changer, synergy, unlock, elevate, empower, streamline, holistic, nuanced, comprehensive, innovative, transformative, navigate, underscore, showcase, "serves as", "boasts".
- Openers and closers: "In today's ...", "In the world of ...", "Let's dive in", "Let's", "As we all know", "I hope this helps", "worth your time", a closing line that restates the introduction, "the future looks bright".
- Moves: "not just X but Y", "it's not about X, it's about Y", rhetorical questions as transitions, "Moreover", "Furthermore", "Additionally", "here's the thing", "to be honest", hedge stacks ("could potentially"), "real" or "actual" as filler, bold used for emphasis, lists of bare noun phrases, three-item lists made for rhythm, stacked one-line aphorisms at the end of paragraphs.
- Em dashes: at most 4 in the whole post.
- No exclamation marks. No emoji.
- Do not use a number, source or detail that is not in the FACTS or DATA. If a detail is missing, leave it out.`

export const POST_FORMAT = `FORMAT (for search and for AI answer engines, in engineering-blog structure):
1. TITLE: starts with "How", "Why" or "What". 8 to 14 words, under 80 characters, main search words early. Plain and matter-of-fact. No "Keyword: subtitle" form. No year-in-front. No "-ing" opening word. No part numbers.
2. INTRODUCTION (before the first heading, 2 to 3 short paragraphs, 60 to 120 words in all): start with the scale fact or the reader's problem, then state the hard question, then state the headline answer with its key number, then one scope sentence that begins "This post" and says what the post covers and what it leaves out. The reader must be able to stop here and have the answer.
3. Then 4 to 6 sections, each with a "## " heading. Mix claim headings ("Pay depends on the role, not the title") and question headings ("Why do the aggregators disagree?"). Use sentence case. Phrase at least two headings as the question a reader would type into a search box. Each section opens by saying why it comes next, then gives its answer, then the detail.
4. One section near the end is called "Limits". It holds every caveat and every rejected alternative, so the other sections stay clean.
5. End with one short closing section that generalises the finding or pays off the opening question. No recap of the introduction.
6. One or two diagrams as inline SVG in a fenced block that starts with three backticks and the word svg. After the block, add one line in italics as the caption, like *Figure: what the diagram shows.* The sentence before a diagram says why the reader is about to see it. Follow the SVG rules below.
7. Use code blocks only where code is the thing being described. Use a table only for a real comparison, with a sentence before it that says what to look for.
8. Mention DevRel Studio at most twice in the body, only where it is the honest answer to a point in the text, with a link such as [our job board](/jobs) or [DevRel Studio](/). State what it does in plain words. Do not write a sales paragraph. A post with no natural place for it mentions it once, in the "Limits" section or the closing section.
9. Length: 1000 to 1500 words in the body.
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

Return JSON with these keys: {"title": string (starts with How, Why or What), "keyword": string, "hard_question": string (the one tension the post resolves, as a single sentence), "shape": "data" | "guide" | "explainer", "angle": string (two sentences: what the post says that others do not), "reader": string, "why_now": string, "kind": "news" | "data" | "evergreen", "search_questions": string[] (3 to 5 real search questions), "source_urls": string[] (from the candidates, may be empty)}`,
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
- Opinion and advice are fine when they follow from the facts. Write advice as plain instruction or as "we" for DevRel Studio. Never write "I".
- If the facts are thin on a point, say less. A shorter correct post is better than a longer guess.

${OUTPUT_SHAPE}`
}

export function writerUser(args: {
  title: string
  hardQuestion?: string
  shape?: string
  angle: string
  keyword: string
  reader: string
  searchQuestions: string[]
  facts: string
  dataBlock: string
}): string {
  return `ARTICLE BRIEF
Working title: ${args.title}
The one hard question: ${args.hardQuestion ?? args.angle}
Shape: ${args.shape ?? 'explainer'}
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

export const AVOID_AI_SYSTEM = `You are an editor. You remove the patterns that make text read as machine-written, and you change nothing else.

Audit the article for these, then rewrite only the flagged spans.
P0: chatbot lines ("I hope this helps", "Great question"), vague attribution ("experts say", "studies show" with no source), significance inflation on ordinary facts, "As of my last update".
P1: the words delve, leverage, harness, robust, seamless, tapestry, landscape, realm, testament, pivotal, crucial, vibrant, foster, cutting-edge, game-changer, synergy, unlock, elevate, empower, streamline, holistic, nuanced, comprehensive, innovative, transformative, navigate, underscore, showcase; "serves as" and "boasts" for "is" and "has"; template openers ("In today's", "In the world of", "Let's"); synonym cycling in one paragraph; "not just X but Y" and "it's not about X, it's about Y"; hedge stacks ("could potentially"); "real" or "actual" as filler; narrated candour ("to be honest", "in the interest of full disclosure"); invented contrast pairs; bold for emphasis; lists of bare noun phrases; generic closers; a closing paragraph that repeats the introduction.
P2: more than 4 em dashes in the article; "Moreover", "Furthermore", "Additionally" at sentence starts; three-item lists made for rhythm; paragraphs of identical length; rhetorical questions used as transitions; stacked one-line aphorisms at the end of paragraphs; a short punchy sentence that does not close a line of reasoning.
Also check cohesion: if a sentence does not follow from the one before it, join it to its neighbour with the real link ("because", "so", "which is why") or remove it if it carries nothing.

Rules for the rewrite:
- Change only flagged spans. Leave clean sentences exactly as they are.
- Never add a fact, number, name, date, source, example or claim. If a concrete detail is missing, leave the vague sentence short or cut it.
- Never add first person, an anecdote, a stance, a joke or a rhetorical flourish. Never convert ordinary sentences into fragments.
- Keep every number, every link, every heading, every table and every SVG block exactly as written.
- Keep the layout markers (TITLE, DESCRIPTION, KEYWORD, SLUG, ---BODY---, ---FAQ---, Q:, A:).
- Return the full article in the same layout and nothing else.`

export function polishUser(draft: string): string {
  return `Audit and rewrite this article under the rules. Return the full article in the same layout.\n\nARTICLE:\n${draft}`
}
