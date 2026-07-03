# React Best Practices — Skill File

## Component Patterns
- Prefer functional components with hooks over class components.
- Use `React.memo()` for expensive renders.
- Colocate state near where it's used — lift only when necessary.
- Extract custom hooks when logic is reused across 2+ components.

## Hook Rules
- Never call hooks conditionally or inside loops.
- Always include dependencies in `useEffect` dependency arrays.
- Use `useCallback` for event handlers passed to child components.
- Use `useMemo` for expensive computed values, not for simple objects.

## State Management
- For local UI state: `useState` or `useReducer`.
- For global state: Zustand, Jotai, or Context (for small values).
- Never store derived data in state — compute it from source.

## File Structure
- One component per file.
- Name files matching the component: `UserProfile.jsx` → `export default function UserProfile()`.
- Group by feature, not by type (prefer `features/auth/` over `components/`).

## Performance
- Use `React.lazy()` + `Suspense` for route-level code splitting.
- Avoid anonymous functions in JSX when possible.
- Never create objects/arrays inline as prop defaults.

## Error Handling
- Use Error Boundaries for UI crash recovery.
- Always handle loading and error states in async components.
