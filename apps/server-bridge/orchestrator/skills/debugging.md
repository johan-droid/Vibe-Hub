# Debugging Protocol — Skill File

## Triage Process

When presented with an error:

1. **Classify the error type:**
   - Syntax Error → Look at the exact line number referenced.
   - Module Not Found → Check the import path and `package.json`.
   - Type Error → Check the variable/function signature.
   - Runtime Error → Look at the stack trace for the origin.
   - Build Error → Check config files (vite, webpack, tsconfig).

2. **Locate the source:**
   - Read the stack trace from TOP to BOTTOM.
   - The first line in YOUR code (not `node_modules`) is usually the culprit.
   - Use `grep_search` to find related usages of the failing symbol.

3. **Understand context:**
   - `read_file` on the failing file to see the full context.
   - Check if the error was introduced by a recent change.

4. **Fix surgically:**
   - Make the MINIMUM change to fix the error.
   - Do NOT refactor or "improve" unrelated code during a fix.
   - One fix per error — don't batch unrelated fixes.

5. **Verify:**
   - Re-run the failing command to confirm the fix.
   - Check for cascading errors.

## Common Patterns

### "Cannot find module"
1. Check if the import path is correct (relative vs absolute).
2. Check if the package is in `package.json`.
3. If missing: suggest `npm install <package>`.

### "X is not a function"
1. Check the export: is it `export default` vs `export { named }`?
2. Check if the import matches: `import X` vs `import { X }`.
3. Check if the module actually exports that symbol.

### "Cannot read property of undefined"
1. Identify which variable is undefined.
2. Trace it backwards through the call chain.
3. Add nullish checks if the data might be absent.

## Anti-Patterns
- ❌ "Shotgun debugging" — changing multiple things hoping one fixes it.
- ❌ Suppressing errors with try/catch without understanding them.
- ❌ Adding `|| ''` or `|| {}` as band-aids without understanding why a value is null.
