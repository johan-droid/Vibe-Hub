# Command Matrix

**IMPLEMENTED** = Found in code and functional
**PARTIAL** = Partially implemented / buggy
**BROKEN** = Code exists but is fundamentally broken
**DOCS ONLY** = Mentioned but not implemented
**UNKNOWN** = Needs further investigation

## Global Scripts
- `npm run validate`: IMPLEMENTED. Validates syntax for core backend files.
- `npm run build:ui`: IMPLEMENTED. Builds the React frontend.
- `npm run sanitize`: IMPLEMENTED. Scans for dummy data and placeholder strings.
- `npm run security:audit`: IMPLEMENTED. Custom security audit script.
- `npm run eval:parity`: IMPLEMENTED. Custom parity evaluation script.
- `npm run dev`: IMPLEMENTED. Concurrently runs `dev:ui` and `dev:server`.
- `npm run docker:build`: IMPLEMENTED. Triggers docker builds for both services.

## Workspace: server-bridge
- `npm test`: IMPLEMENTED. Runs Vitest suite.
- `npm start`: IMPLEMENTED.

## Workspace: user-interface
- `npm test`: IMPLEMENTED. Runs Vitest suite.
- `npm run lint`: IMPLEMENTED. Runs ESLint.
- `npm run build`: IMPLEMENTED.
- `npm run dev`: IMPLEMENTED.
