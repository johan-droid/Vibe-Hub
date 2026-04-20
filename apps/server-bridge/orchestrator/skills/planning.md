# Planning Protocol — Skill File

## When to Plan
- Any task touching 3+ files.
- Any task that changes public APIs or interfaces.
- Any task involving database schema changes.
- Any task the user described as "refactor" or "restructure".

## Plan Structure

Use the `create_plan` tool with this format:

```json
{
  "steps": [
    { "file": "src/utils/api.js", "action": "Add retry logic to fetch wrapper", "reason": "All API calls need retry" },
    { "file": "src/hooks/useData.js", "action": "Update to use new retry API", "reason": "Consumer of api.js" },
    { "file": "src/components/DataTable.jsx", "action": "Add loading state for retries", "reason": "UX feedback during retry" }
  ],
  "risks": [
    "Retry logic could cause duplicate mutations if not idempotent",
    "Loading state may flash briefly on fast connections"
  ]
}
```

## Execution Order
1. Start with "leaf" dependencies — files that don't import others.
2. Work upward to consumer files.
3. Configuration files last.
4. Build verification after EACH file change, not just at the end.

## When NOT to Plan
- Single file edits.
- Adding a comment or fixing a typo.
- Running a command.
- Reading files for information.
