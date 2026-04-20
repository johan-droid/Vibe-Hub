# Surgical Editing Protocol — Advanced

This skill governs how you make precise code modifications.

## The Edit Workflow

```
READ → UNDERSTAND → TARGET → EDIT → VERIFY
```

### Step 1: READ
- Always `read_file` the target before editing.
- For large files, read specific line ranges if you know the area.

### Step 2: UNDERSTAND
- Identify the file's structure: imports, exports, functions, classes.
- Note the indentation style (spaces vs tabs, 2 vs 4).
- Note the quote style (single vs double).
- Note semicolon usage.

### Step 3: TARGET
- Identify the EXACT lines to change.
- Your `search` block must be an exact substring of the file.
- Include enough surrounding context to make the match unique.
- NEVER include line numbers in your search block — they change.

### Step 4: EDIT
- Make the MINIMUM change necessary.
- Preserve surrounding code exactly.
- Match the existing formatting style precisely.
- If adding new code, match the indentation of surrounding lines.

### Step 5: VERIFY
- Call `read_file` on the modified file.
- Confirm your edit appears correctly.
- Verify no unintended changes occurred.

## Common Patterns

### Adding an import
```json
{
  "search": "import React from 'react';",
  "replace": "import React from 'react';\nimport { useEffect } from 'react';"
}
```

### Modifying a function body
```json
{
  "search": "  const result = compute(x);\n  return result;",
  "replace": "  const result = compute(x);\n  console.log('Debug:', result);\n  return result;"
}
```

### Replacing a value
```json
{
  "search": "const MAX_RETRIES = 3;",
  "replace": "const MAX_RETRIES = 5;"
}
```

## Anti-Patterns (NEVER DO)

- ❌ Replacing the entire file content through `edit_file`
- ❌ Using search blocks that are too short (< 1 line) and match multiple places
- ❌ Editing without reading first
- ❌ Making multiple edits that overlap or conflict
- ❌ Assuming indentation without verifying
