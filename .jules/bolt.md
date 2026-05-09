
## 2024-05-03 - [RegExp Statefulness and Path Checking]
**Learning:** RegExp `test()` in loops is faster without the `g` flag because it remains stateless, avoiding manual `lastIndex` resets. Also, `.some()` with `.includes()` is slower and error-prone (e.g., `build` matching `my_build.js`) compared to a single pre-compiled Regex for path ignoring.
**Action:** Use stateless Regex (no `g` flag) for simple `test()` checks in loops, and prefer pre-compiled Regex over array iteration for exact path exclusions.

## 2024-05-03 - [VFS Path Checking Parallelization]
**Learning:** When listing directory entries, iterating through `readdir` results sequentially using `await` for operations like git ignore checks is a bottleneck. We can map the paths to an array of promises, throttle them using a concurrency limiter (like `pLimit`), and execute them in parallel using `Promise.all()`.
**Action:** Use `Promise.all()` with a `pLimit` concurrency queue instead of sequential `await` in `map()` or `for...of` loops for file system operations to prevent EMFILE errors while maximizing speed.
