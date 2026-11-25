import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.output/**',
      '**/.wxt/**',
      '**/.venv/**',
      // Generated architecture-graph snapshots (`graphify update`).
      'graphify-out/**',
      // Vendored career-ops provider layer (MIT): files are byte-identical to
      // upstream so `sync:providers` content hashes stay stable. Upstream
      // carries its own lint noise (unused vars, irregular whitespace); do not
      // "fix" them here or the drift check will flag every vendored file.
      'extension/src/background/providers/**',
      'extension/src/background/lib/**',
      'extension/src/background/ats-vendor.mjs',
      'extension/src/background/liveness-api.mjs',
      'extension/src/background/himalayas-posting.mjs',
      'extension/src/background/robots-check.mjs',
      'extension/scripts/ports/**',
      'server/ingest/src/vendored/**',
      'templates/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,mjs}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    rules: {
      'no-console': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
];
