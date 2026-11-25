# scripts/ports/

Browser-adapted versions of the vendored career-ops provider layer (MIT;
source of truth under `../../Scratch/career-ops`). `scripts/vendor.mjs` copies
the upstream files verbatim and then overwrites the entries here, so the
vendored tree under `src/background/providers/` is byte-identical to these
ports for the files that cannot run in a browser as copied.

Every port keeps the original MIT header/attribution and documents its
deviations in-file. Current ports:

| File | Why it is ported |
| ---- | ---------------- |
| `_http.mjs` | Upstream imports `_dns-cache.mjs` (patches `node:dns`) and relies on undici's `redirect:'error'` TypeError shape. Port removes the DNS cache (browser owns DNS) and pins `redirect:'manual'` + a 3xx/opaqueredirect guard that throws the same pinned non-retryable shape (SSRF trust guard). |
| `_registry.mjs` | Upstream loads providers via `fs.readdirSync` + dynamic import. Port wraps the build-time static index (`providers/index.js`); `resolveProvider()` unchanged. |
| `_profile-keywords.mjs` | Upstream reads `config/profile.yml` from disk (fs + js-yaml). Port keeps pure `profileTargetKeywords()`, and `resolveProfileKeywords()` is a documented no-op returning `[]` (no filesystem in the browser). |
| `local-parser.mjs` | Upstream spawns a configured local parser via `child_process`. A browser cannot exec local commands; the port keeps the `local-parser` id in the registry but `detect()` returns null and `fetch()` throws a clear error. |
| `alibaba.mjs` | Upstream imports `randomUUID` from `node:crypto`. Port mints the CSRF token from WebCrypto (`globalThis.crypto.randomUUID`) with a Math.random fallback. |
| `radancy.mjs` | Upstream imports `randomUUID` from `node:crypto`. Port replaces it with a browser-safe `makeNonce()` function backed by WebCrypto and Math.random fallback. |
| `mokahr.mjs` | Upstream uses top-level `Buffer.from()` which crashes browser execution at evaluation time (`ReferenceError: Buffer is not defined`). Port removes top-level Buffer usage and guards AES decryption for browser contexts. |
| `posting-close.mjs` | Upstream imports `../url-key.mjs` (uses `node:fs`/`node:path`) and `./scan-history-columns.mjs` (reads scan-history.tsv from disk). Port keeps the pure `closesAtIso` function unchanged and stubs `closeDatesByUrl`/`closeDateForUrl` as documented no-ops returning empty Map/`''`. Stored in `scripts/ports/` and applied to `src/background/lib/` (not `providers/`). |
| `robots-check.mjs` | Upstream imports `isIP` from `node:net` and dynamically imports `node:dns/promises`. Port replaces `isIP` with a pure-JS IPv4/IPv6 literal check and skips `node:dns/promises` when no custom resolver is injected (browser owns DNS). Stored in `scripts/ports/` and applied to `src/background/`. |
| `himalayas-posting.mjs` | Upstream has a CLI `main()` at the bottom importing `node:fs/promises` and `is-main-module.mjs`. Port strips the CLI `main()` block while keeping `resolveHimalayasPosting`, `classifyHimalayasPosting`, and `retrieveHimalayasPosting` intact for `liveness-api.mjs`. Stored in `scripts/ports/` and applied to `src/background/`. |

`tests/` mirrors the lifted provider tests that had to change:

| Test | Why it is ported |
| ---- | ---------------- |
| `workday.test.mjs` | Strips the unused `warn, run` imports (kept for eslint cleanliness). |
| `_profile-keywords.test.mjs` | Replaces the fs/file-reading assertions with the browser no-op contract. |
| `vdab.test.mjs` | Replaces the config/profile.yml tmp-cwd fallback assertions with the browser throw-on-empty-keywords contract. |