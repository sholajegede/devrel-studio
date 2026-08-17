import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  resolve: {
    // Mirrors the `@/*` path alias in tsconfig.json.
    alias: { '@': resolve(__dirname, '.') },
  },
  test: {
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    // Pure logic runs in node; component tests opt into jsdom with a
    // `@vitest-environment jsdom` docblock. Loading jsdom for every file would
    // slow the suite down for the majority that never touches the DOM.
    environment: 'node',
    setupFiles: ['tests/setup.ts'],
  },
})
