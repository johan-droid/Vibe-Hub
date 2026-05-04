# Frontend Technical Documentation

## Architecture
The frontend is a React application built with Vite. It serves as an IDE interface, communicating with the `server-bridge` backend.
The state management uses Zustand, and the routing is handled by React Router DOM.

## Project Structure
- `src/`
  - `features/`: Contains UI features like chat, editor, security audit, shared components, and the swarm intelligence dashboard.
  - `hooks/`: Custom React hooks, including `useAgent` (for websocket communication) and `useBackendSignals`.
  - `pages/`: Top-level page components (`LandingPage`, `Workspace`, `AuthCallback`).
  - `services/`: API client (`api.js`) and websocket client (`socket.js`).
  - `store/`: Zustand state management (`useStore.js`, `useVfsStore.js`, `idbStorage.js` using IndexedDB).
  - `vfs/`: Virtual File System implementation using `@webcontainer/api` (`container.js`).

## State Management
State is managed using `zustand` and persisted to IndexedDB using `idb-keyval`.
The `useStore` handles:
- Authentication & Hydration
- Layout State (sidebar, chat, terminal size, theme)
- Agent Core State (messages, thinking state, neural status)
- VFS & Code State (open files, active file, diff data, terminal output)

## Communication
- **REST API (`services/api.js`)**: Fetches endpoints (health, runtime diagnostics, auth URLs, user profile). Handles JWT tokens locally via localStorage.
- **WebSockets (`services/socket.js`)**:
  - `SwarmSocket`: Connects to `/ws?token=...`, handles AI agent thought streams, tool requests, result updates, and github workflow completions.
  - `OrchestratorSocket`: Uses Socket.IO for XState streaming from the backend.

## Theming & UI
- Styling relies on Tailwind CSS (`tailwind.config.js`). It uses a strict Material 3 Tonal Palette (Dark Mode Base).
- The default theme is `dark` and cannot be switched away from a dark appearance easily, as defined by the user memory.
- UI components use `lucide-react` for iconography.
- The UI includes an Editor (using `react-syntax-highlighter` or a file viewer), a Terminal (using `@xterm/xterm`), and a Chat Interface.

## Important Components
- `Workspace.jsx`: The main layout component showing the sidebar (explorer/swarm), editor/diff view, terminal, and chat panel. Uses Framer Motion for responsive sliding panels.
- `App.jsx`: Setup React Router and auth restoration.

## Virtual File System (VFS)
The `VFSContainer` interacts with `@webcontainer/api` and `isomorphic-git`. It manages files locally in the browser to run terminal commands, execute code, and perform git operations. It incorporates a concurrency-limiting promise queue (`pLimit`) to avoid `EMFILE` errors.

## Build and Tools
- Vite (`vite.config.js`)
- ESLint (`eslint.config.js`)
- Commands: `pnpm dev`, `pnpm build`, `pnpm lint`, `pnpm preview`
