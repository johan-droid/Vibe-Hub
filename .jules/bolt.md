
## 2024-05-03 - [RegExp Statefulness and Path Checking]
**Learning:** RegExp `test()` in loops is faster without the `g` flag because it remains stateless, avoiding manual `lastIndex` resets. Also, `.some()` with `.includes()` is slower and error-prone (e.g., `build` matching `my_build.js`) compared to a single pre-compiled Regex for path ignoring.
**Action:** Use stateless Regex (no `g` flag) for simple `test()` checks in loops, and prefer pre-compiled Regex over array iteration for exact path exclusions.
