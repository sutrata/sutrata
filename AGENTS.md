# AGENTS.md

This file provides guidance to AI coding agents (Claude Code, Antigravity, etc.) when working with code in this repository.

## What this is

Sutrata is a screenplay editor for multilingual (Latin + Indic/Unicode) scripts, built around **Sutra** — a Fountain-inspired plain-text screenplay format. It ships as both a web PWA and a Tauri desktop app. The project is being built milestone by milestone (M1 parser+editor → M2 Indic/Unicode → M3 export/workflow → M4 voice/AI); see [docs/sutrata_spec.md](docs/sutrata_spec.md) for the product spec and roadmap, and [docs/sutra_format_spec.md](docs/sutra_format_spec.md) for the normative format spec — these are the authoritative design decisions.

## Commands

pnpm workspaces. Run from the repo root unless noted.

```bash
pnpm install                              # install all workspace deps
pnpm build                                # build parser, then editor, then app (each depends on the previous one's dist/)
pnpm test                                 # run tests in every package (pnpm -r test)

pnpm dev:web                              # Vite dev server for the web app
pnpm dev:tauri                            # Tauri dev shell (requires Rust)

# Per-package (use --filter from root, or cd into the package)
pnpm --filter @sutrata/parser test        # vitest run
pnpm --filter @sutrata/parser test:watch
pnpm --filter @sutrata/editor test        # vitest run (jsdom) — this is where almost all app-level tests live
pnpm --filter @sutrata/app test           # vitest run (jsdom) — thin shell, few/no tests
pnpm --filter @sutrata/app test:e2e       # playwright

# Single test file / single test
pnpm --filter @sutrata/parser test -- round-trip         # by filename substring
pnpm --filter @sutrata/editor test -- -t "scene heading" # by test name
```

`@sutrata/parser` and `@sutrata/editor` both build with `tsc` (editor's build also copies its two CSS files into `dist/`), and each downstream package imports the previous one's compiled `dist/`. **If you change parser or editor source, rebuild it (`pnpm --filter @sutrata/parser build` / `pnpm --filter @sutrata/editor build`) before the next package picks up the change** — `pnpm build` does this in order, but `dev:web` against a stale `dist/` will not.

CI (`.github/workflows/ci.yml`) runs four independent jobs: parser test+build, editor test+build, app build, and a **tofu gate** (`node scripts/check-tofu.js`, uses `canvas`) that fails if any required script renders missing glyphs (□). The same job runs `python scripts/check-font-coverage.py`, which reads the *bundled* Noto Sans/Serif Latin files and fails if any ISO 15919 letter or combining mark is missing (those files are re-subset from the full fonts; see `packages/app/public/fonts/README.md`).

## Architecture

### Four packages

- **`@sutrata/parser`** — the Sutra reference implementation. Text ↔ AST, Fountain import/export, Indic → Latin romanization for export (ISO 15919 and colloquial variants). Zero UI dependencies, published as OSS. This is the contract everything else depends on.
- **`@sutrata/editor`** — React 18 + Vite + ProseMirror. The reusable editor library: `DocumentContext`, the ProseMirror editor and all its plugins, every panel (navigator, find/replace, title page, style dialog, settings, statistics), exporters (PDF/DOCX/Fountain/workflow reports), i18n (locales + `useTranslation`), spellcheck, autocomplete, and the extension-point interfaces (`packages/editor/src/extensions/`). This is what Sutrata Cloud will embed — see `packages/editor/src/index.ts` for the public entry point. Almost all of the app-level test suite (286 tests) lives here now, not in `@sutrata/app`.
- **`@sutrata/app`** — thin standalone shell. Wires `@sutrata/editor` to a local `StorageAdapter` (IndexedDB + File System Access API, `local-storage-adapter.ts`) and mounts it. `App.tsx` and `main.tsx` are the entire composition; `file/storage.ts` and `file/file-access.ts` are the concrete local I/O the adapter wraps. Also builds the PWA and the Tauri renderer.
- **`@sutrata/tauri`** — thin Tauri v2 shell written in Rust. Replicates the native desktop interface via a custom `initialization_script` injected into the webview window, mapping the global `window.desktopAPI` to custom Rust commands using `rfd` for native dialogs.

### Extension points (`@sutrata/editor/src/extensions/`)

The editor takes its dependencies on the outside world through injected interfaces rather than importing them directly, so an embedder (the OSS app, eventually Sutrata Cloud) can swap them without forking the editor (OSS spec §11.5). Only one is fully wired end-to-end so far:

- **`StorageAdapter`** (`extensions/storage-adapter.ts`) — **done**. `DocumentProvider` takes it as a required prop; `DocumentContext.tsx` and `StyleDialog.tsx` go through `useStorageAdapter()` instead of importing storage code directly. `@sutrata/app` supplies `localStorageAdapter`. Follow this exact pattern (interface + React context + `useXAdapter()` hook in `extensions/`, required provider prop, app-side concrete implementation) for the next one.
- **`AIProvider`, `SpeechProvider`, `SessionContext`, `PanelRegistry`, `CommandRegistry`, `ExportRegistry`, `CollabBinding`, `DecorationProvider`** (`extensions/types.ts`) — **type-only stubs, not wired**. `ai-client.ts`/`voice-service.ts` are still direct imports inside `@sutrata/editor` (6 components use them: VoiceToolbar, SettingsDialog, SceneNavigator, StatusBar, VoiceConfirmDialog, OnboardingDialog). Wiring `AIProvider`/`SpeechProvider` properly is the next extraction pass — don't assume these interfaces are load-bearing yet.

### Sutra text is the single source of truth

There is **no global state manager**. The Sutra text string lives in `packages/editor/src/context/DocumentContext.tsx` and everything derives from it:

```
Sutra text ──► Sutra AST ──► ProseMirror doc   (editor)
                              ──► Scene list          (navigator)
                              ──► Frontmatter object  (title page form)
```

- Panels read from the **AST**, never from ProseMirror's internal model directly.
- ProseMirror → text on every transaction; text → ProseMirror on file open and source-mode edits.
- `DocumentContext.setText` re-parses on every change — keep `parse()` fast (target: <5ms incremental re-parse).

### Two serialization paths — know which one you're touching

This is the subtlety that trips people up. There are **two ways Sutra text gets regenerated**, and they have different fidelity guarantees:

1. **Parser serializer** (`packages/parser/src/serializer.ts`) — emits each node's captured `raw` source string. This is what guarantees **byte-faithful round-trip**: open a file and save it unchanged and you get identical bytes. Every AST node carries a `raw` field captured at parse time; the serializer mostly just stitches `raw` strings back together. Don't "improve" the serializer to regenerate text from structured fields — that breaks the round-trip guarantee and its conformance tests (`packages/parser/tests/round-trip.test.ts`, which run against the `.sutra` corpus in `packages/parser/conformance/`).

2. **Editor serializer** (`packages/editor/src/editor/prosemirror-to-sutra.ts`) — regenerates Sutra from the ProseMirror doc, from scratch (the editor doc does not carry `raw`). This path is used after the user *edits*, where regeneration is unavoidable. Round-trip fidelity here is best-effort, not byte-exact.

So: round-trip tests exercise path 1; editing exercises path 2. A change that looks correct in one may regress the other.

### Parser internals

`lexer.ts` (line → token) → `parser.ts` (tokens → AST, handles block grouping, scene nesting, dual-dialogue lookahead) → `serializer.ts`. `frontmatter.ts` has a minimal hand-rolled YAML parser (string scalars + one level of nested maps for the multilingual `title:` — do not assume full YAML). `fountain.ts` is import (lossless for well-formed Fountain) + lossy export (returns warnings for dropped metadata/one-liners). Romanized export: `romanize.ts` (Indic → Latin, one way, export only; strict/readable ISO 15919 plus a diacritic-free colloquial variant; `romanizeSutra` returns a romanized Sutra copy that the exporters parse like any document). `transliterate.ts` + `src/translit-tables/` is the older Latin → Indic engine, kept but unused by export.

**Unknown keys and attributes must round-trip.** Forward-compatibility is a hard requirement — unrecognized metadata keys, frontmatter keys, and scene-heading attributes are preserved verbatim, not dropped. There are tests asserting this; keep them green.

### Editor (ProseMirror)

All paths below are relative to `packages/editor/src/`. `editor/schema.ts` maps one node/mark type per Sutra element. The Sutra↔ProseMirror bridge is the pair `sutra-to-prosemirror.ts` / `prosemirror-to-sutra.ts`. Behavior lives in plugins under `src/editor/` (keymap with smart-Enter element cycling, IME composition handling, grapheme-cluster-aware cursor movement, language-class tagging, transliteration input). Cross-cutting editor events go through `editor/editor-bus.ts`.

## Conventions

- ESM throughout (`"type": "module"`). Parser's internal relative imports use `.js` extensions (TypeScript `moduleResolution: bundler` emitting ESM) — match that when adding parser files.
- `noUncheckedIndexedAccess` is on. Array/record indexing yields `T | undefined`; the code uses `!` liberally after structural checks — follow the surrounding style rather than introducing optional chaining everywhere.
- Editor and app tests run in **jsdom** with `@testing-library/react` + `vitest` globals (no per-file `import { describe }`). Parser tests are plain node-environment vitest.
- The two normative specs are `docs/sutrata_spec.md` (product spec and roadmap) and `docs/sutra_format_spec.md` (format grammar). When implementing element behavior, the format spec is the source of truth for sigils and reserved keys.
- Indic/Unicode correctness is a first-class concern, not a nice-to-have: logical-order storage (never visual order), grapheme-cluster-aware cursor/selection per UAX #29 via `Intl.Segmenter`, NFC-normalized matching in find/replace, and zero tofu (enforced by the CI tofu gate).
