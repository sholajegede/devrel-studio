import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

// Deliberately narrow.
//
// `npm run lint` was configured but there was no config file, so it had never
// actually run — which is how a `useMemo` placed after an early `return` reached
// production. That is precisely what rules-of-hooks catches, so the config
// starts with the rules that catch real bugs rather than a full style pass that
// would bury them under hundreds of formatting complaints.

export default [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'convex/_generated/**',
      'next-env.d.ts',
    ],
  },
  {
    files: ['**/*.{ts,tsx}'],
    // Parser only — none of the typescript-eslint rule sets are enabled, so this
    // adds the ability to read TS syntax without adding a wall of new opinions.
    languageOptions: { parser: tseslint.parser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      // Hooks must run in the same order on every render. An early return above
      // a hook changes the count between renders and throws at runtime.
      'react-hooks/rules-of-hooks': 'error',
      // Stale-closure bugs. A warning: the existing code has a number of these
      // and they are judgement calls, not automatic defects.
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
]
