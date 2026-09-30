'use node'

import { v } from 'convex/values'
import { extractText, getDocumentProxy } from 'unpdf'
import { internal } from './_generated/api'
import { internalAction } from './_generated/server'

export const parseStoredCv = internalAction({
  args: {
    userId: v.id('users'),
    storageId: v.id('_storage'),
    fileName: v.string(),
    contentType: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    const blob = await ctx.storage.get(args.storageId)
    if (!blob) return

    const bytes = new Uint8Array(await blob.arrayBuffer())
    const isPdf = args.contentType === 'application/pdf' || /\.pdf$/i.test(args.fileName)

    let text = ''
    try {
      if (isPdf) {
        const pdf = await getDocumentProxy(bytes)
        const extracted = await extractText(pdf, { mergePages: true })
        text = Array.isArray(extracted.text) ? extracted.text.join('\n') : extracted.text
      } else {
        text = new TextDecoder().decode(bytes)
      }
    } catch (error) {
      console.error('[cv] could not read file:', error)
    }

    await ctx.runMutation(internal.jobBoard.applyCvText, {
      userId: args.userId,
      storageId: args.storageId,
      fileName: args.fileName,
      text,
    })
  },
})
