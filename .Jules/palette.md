## 2024-05-03 - Accessible Icon Buttons
**Learning:** Icon-only buttons lacking ARIA labels block screen-reader access and tooltips improve UX discoverability.
**Action:** Always include `aria-label` and `title` for buttons without text content.

## 2024-05-10 - Accessibility in dynamic icon lists and interactive toggles
**Learning:** Found multiple instances where dynamic icon lists (like repositories or files) lacked descriptive ARIA labels explaining their action (e.g. `Remove file [filename]`), and toggle buttons lacked `aria-expanded` state.
**Action:** When mapping over items to generate icon buttons, dynamically generate the `aria-label` to include context (e.g. `aria-label={\`Remove ${item.name}\`}`). Ensure toggle buttons use `aria-expanded` reflecting their state. Also verify all `<button>` tags include `type="button"` to avoid unintended default form submissions.
