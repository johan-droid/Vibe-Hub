## 2026-05-10 - [O(N) Iteration Optimization for Maps]
**Learning:** Found a specific anti-pattern in `apps/server-bridge/vfs/container.js` where large Map instances (`this.staging`) were being converted to arrays via `Array.from()` and then processed with multiple chained `.filter()` operations. This caused excessive memory allocations and redundant O(N) traversals.
**Action:** Always prefer a single `for...of` loop over Map iterators to aggregate counts or filter items in one pass. Avoid `Array.from(...).filter(...)` chains when processing large in-memory state collections.
