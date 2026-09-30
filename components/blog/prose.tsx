import Link from 'next/link'
import type { Block, Inline } from '@/lib/blog/markdown'
import { sanitizeSvg } from '@/lib/blog/svg'

function Inlines({ nodes }: { nodes: Inline[] }) {
  return (
    <>
      {nodes.map((node, index) => {
        switch (node.t) {
          case 'text':
            return <span key={index}>{node.v}</span>
          case 'code':
            return (
              <code key={index} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.9em] text-foreground">
                {node.v}
              </code>
            )
          case 'strong':
            return <strong key={index} className="font-semibold text-foreground"><Inlines nodes={node.c} /></strong>
          case 'em':
            return <em key={index}><Inlines nodes={node.c} /></em>
          case 'link':
            return node.href.startsWith('/') || node.href.startsWith('#') ? (
              <Link key={index} href={node.href} className="text-accent underline underline-offset-2 hover:no-underline">
                <Inlines nodes={node.c} />
              </Link>
            ) : (
              <a key={index} href={node.href} target="_blank" rel="noopener" className="text-accent underline underline-offset-2 hover:no-underline">
                <Inlines nodes={node.c} />
              </a>
            )
        }
      })}
    </>
  )
}

/** Renders parsed Markdown. Nothing here writes raw HTML except a checked SVG. */
export function Prose({ blocks }: { blocks: Block[] }) {
  return (
    <div className="space-y-5 text-[17px] leading-[1.75] text-foreground/90">
      {blocks.map((block, index) => {
        switch (block.t) {
          case 'h':
            return block.level === 2 ? (
              <h2 key={index} id={block.id} className="scroll-mt-24 pt-6 text-2xl font-semibold tracking-tight text-foreground">
                <Inlines nodes={block.c} />
              </h2>
            ) : (
              <h3 key={index} id={block.id} className="scroll-mt-24 pt-2 text-xl font-semibold text-foreground">
                <Inlines nodes={block.c} />
              </h3>
            )
          case 'p':
            return <p key={index}><Inlines nodes={block.c} /></p>
          case 'ul':
            return (
              <ul key={index} className="ml-5 list-disc space-y-2">
                {block.items.map((item, i) => <li key={i}><Inlines nodes={item} /></li>)}
              </ul>
            )
          case 'ol':
            return (
              <ol key={index} className="ml-5 list-decimal space-y-2">
                {block.items.map((item, i) => <li key={i}><Inlines nodes={item} /></li>)}
              </ol>
            )
          case 'quote':
            return (
              <blockquote key={index} className="border-l-2 border-accent pl-4 text-muted-foreground">
                <Inlines nodes={block.c} />
              </blockquote>
            )
          case 'code':
            return (
              <pre key={index} className="overflow-x-auto rounded-xl border border-border bg-muted/60 p-4 text-sm leading-relaxed">
                <code className="font-mono">{block.v}</code>
              </pre>
            )
          case 'svg': {
            const svg = sanitizeSvg(block.v)
            if (!svg) return null
            return (
              <figure key={index} className="my-8 rounded-xl border border-border bg-card p-4">
                <div
                  className="mx-auto max-w-full overflow-x-auto text-foreground [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full"
                  dangerouslySetInnerHTML={{ __html: svg }}
                />
                {block.caption && <figcaption className="mt-3 text-center text-sm text-muted-foreground">{block.caption}</figcaption>}
              </figure>
            )
          }
          case 'table':
            return (
              <div key={index} className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-[15px]">
                  <thead>
                    <tr className="border-b border-border">
                      {block.head.map((cell, i) => <th key={i} className="px-3 py-2 font-semibold text-foreground"><Inlines nodes={cell} /></th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, r) => (
                      <tr key={r} className="border-b border-border">
                        {row.map((cell, c) => <td key={c} className="px-3 py-2 align-top"><Inlines nodes={cell} /></td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          case 'hr':
            return <hr key={index} className="border-border" />
        }
      })}
    </div>
  )
}
