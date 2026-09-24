---
"@sutrata/editor": minor
---

Scene navigator marks scenes whose heading has no `{#id}` with a warning-colored edge and icon ("Scene has no ID"). Comments, scene-level diff and page locking need scene IDs. New CSS tokens `--cs-ui-warning` / `--cs-ui-warning-subtle`; new locale key `navigator.missingId` in all 12 locales.
