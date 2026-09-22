# Contributing to Sutrata

Thanks for considering a contribution. A few things to know before opening a PR.

## Contributor License Agreement

Every outside contribution requires signing a Contributor License Agreement (CLA) before
it can be merged. A CLA bot will comment on your first pull request with instructions —
you won't be able to sign it in advance.

**Why:** the project is published under GPL-3.0-or-later (app, desktop shell) and
Apache-2.0 (`@sutra/parser`), but the project owner also needs to be able to license the
same code commercially to Sutrata Cloud, the paid product built on top of this app (see
`docs/sutrata_spec.md` §1.7). The CLA keeps copyright with the project owner so that grant
is possible, while the public continues to receive the code under the open licenses above
— it does not change what you can do with the code as a contributor or downstream user.

## Which license applies to what you're changing

| You're changing... | License | Package |
|---|---|---|
| The Sutra format grammar/parser, `.sutra` ↔ AST, Fountain import/export, romanization | Apache-2.0 | `@sutra/parser` |
| The editor, panels, exporters, i18n | GPL-3.0-or-later | `@sutrata/editor` |
| The app shell, storage adapter | GPL-3.0-or-later | `@sutrata/app` |
| The Tauri desktop shell | GPL-3.0-or-later | `@sutrata/tauri` |
| The Sutra format specification itself (`docs/sutra_format_spec.md`) | CC BY 4.0 | — |

## Before you open a PR

- Read `AGENTS.md` for the build/test commands, architecture notes, and the two
  serialization paths (parser vs. editor) — a change that's correct for one can silently
  regress the other.
- If you changed `packages/parser`, rebuild it (`pnpm --filter @sutra/parser build`)
  before testing the app against it.
- Run the full suite: `pnpm build && pnpm test`.
- Format-level changes (new sigils, reserved keys, grammar rules) should be proposed
  against `docs/sutra_format_spec.md` first — it's the normative reference, and the parser
  is expected to conform to it, not the other way around.
- Keep the unknown-key/attribute round-trip guarantee intact: forward-compatibility for
  unrecognized metadata is a hard requirement, and there are conformance tests for it.

## Reporting issues

Bug reports and format-spec questions are both welcome as GitHub issues. For anything that
might be a security issue, please don't open a public issue — see `SECURITY.md` (once
published) or contact the maintainer directly.
