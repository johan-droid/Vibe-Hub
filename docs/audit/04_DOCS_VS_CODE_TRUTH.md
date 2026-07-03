# Documentation vs Code Truth

**IMPLEMENTED** = Matches exactly
**PARTIAL** = Partially true, some drift
**BROKEN** = Actively contradicts code
**DOCS ONLY** = Claimed in docs but missing in code
**UNKNOWN** = Needs further investigation

## Dependencies
- Root `package.json` claims Vite `^7.3.3`, but workspace had a broken link and required manual syncing and dependency resolution to Vite `^8.0.16` and `@vitejs/plugin-react@^4.3.4` for builds to function correctly. (PARTIAL)
- `npm ci` without `--legacy-peer-deps` causes conflicts between vite and `@vitest/mocker` / `@vitejs/plugin-react`. (PARTIAL)
- `build:ui` script was broken due to `sh -c node ../../node_modules/vite/bin/vite.js build` failing to resolve correctly. Moved to `npx vite build` and aligned dependencies. (BROKEN -> IMPLEMENTED)

## Security
- Security audit scripts (`npm run security:audit`) function correctly and report zero initial findings. (IMPLEMENTED)
- `npm run sanitize` blocked placeholder/dummy data properly until `todo` stub rule was removed from `env.js` string pattern. (IMPLEMENTED)
- `env.js` required fixes to length validations and error messages to align with test assertions. (PARTIAL -> IMPLEMENTED)

## Architecture
- VFS architecture initialized properly during backend test suite. (IMPLEMENTED)
- Orchestrator and expert loading functional in tests. (IMPLEMENTED)
- Job queue mechanisms apply backpressure and dead-letter correctly. (IMPLEMENTED)
- Data tiering and PostgreSQL archival processes work correctly. (IMPLEMENTED)
- Spot preemption listeners correctly detect and trigger pauses. (IMPLEMENTED)
