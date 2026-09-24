# Sutrata

A screenplay editor for multilingual scripts — Latin, Hindi, Tamil, Telugu, Kannada, Malayalam, Bengali, Gujarati, Punjabi, Odia, and more. Built around **Sutra**, a Fountain-inspired plain-text screenplay format. Ships as a web PWA and a Tauri desktop app.

## Getting started

```bash
pnpm install          # install all workspace dependencies

pnpm dev:web          # start the Vite dev server (web app)
pnpm dev:tauri        # start the Tauri desktop shell (requires Rust)

pnpm build            # build parser + app (production)
pnpm test             # run all tests across all packages
```

The web app runs at `http://localhost:5173` by default.

### Development environment setup

#### macOS / Linux

Prerequisites: Node.js 18+, Rust, and native build tools.

```bash
# macOS (via Homebrew)
brew install node rust

# Debian/Ubuntu
sudo apt install nodejs npm rustup build-essential

# Then install Rust and pnpm
rustup default stable
npm install -g pnpm
```

#### Windows

Use `winget` (Windows 10 22H2+ / Windows 11 only). Run these commands in **native PowerShell** (not WSL):

```powershell
# Rust
winget install Rustlang.Rustup

# MSVC linker (required for Tauri compilation)
winget install --id Microsoft.VisualStudio.2022.BuildTools --override "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools;includeRecommended"

# Node.js
winget install OpenJS.NodeJS.LTS

# After installation, close and reopen PowerShell, then:
npm install -g pnpm
```

**Cross-compilation on Windows:** Building for a different CPU architecture (ARM ↔ x86-64) is fully supported. Ensure both MSVC toolsets are installed:

```powershell
winget install --id Microsoft.VisualStudio.2022.BuildTools --override "--wait --passive --add Microsoft.VisualStudio.Component.VC.Tools.x86.x64;includeRecommended --add Microsoft.VisualStudio.Component.VC.Tools.ARM64;includeRecommended"
```

Then specify the target explicitly (from `packages/tauri`):

```powershell
cd packages\tauri

# Build for x86-64 (Intel/AMD)
pnpm exec tauri dev --target x86_64-pc-windows-msvc

# Build for ARM64 (Surface Pro X, etc)
pnpm exec tauri dev --target aarch64-pc-windows-msvc
```

Omit `--target` to build natively for your current CPU architecture. Modern Windows 11 can run binaries for both architectures — the OS detects the PE header and runs natively or emulated as needed.

## Keyboard shortcuts

### Block types

Apply to the block the cursor is currently in (WYSIWYG mode only).

| Block | Shortcut |
|---|---|
| Scene Heading | `Alt+Shift+H` |
| Action | `Alt+Shift+A` |
| Character | `Alt+Shift+C` |
| Dialogue | `Alt+Shift+D` |
| Parenthetical | `Alt+Shift+P` |
| Transition | `Alt+Shift+X` |
| Section | *(toolbar only)* |
| Note | `Alt+Shift+N` |

### Editing

| Action | Shortcut |
|---|---|
| Undo | `Ctrl+Z` |
| Redo | `Ctrl+Y` / `Ctrl+Shift+Z` |
| Bold | `Ctrl+B` |
| Italic | `Ctrl+I` |
| Underline | `Ctrl+U` |

On macOS, `Ctrl` → `Cmd`.

### File

| Action | Shortcut |
|---|---|
| Save | `Ctrl+S` |
| Find & Replace | `Ctrl+F` |

### View

| Action | Shortcut |
|---|---|
| Toggle source / WYSIWYG | `Ctrl+Shift+E` |
| Toggle toolbar ribbon | `Ctrl+Shift+R` |
| Toggle scene navigator | `Ctrl+Shift+B` |
| Toggle transliteration mode | `Ctrl+Shift+K` |

## Sutra format

Sutrata stores screenplays as plain `.sutra` text files. Each line begins with a sigil that identifies the element type:

| Element | Sigil | Example |
|---|---|---|
| Scene Heading | `##` | `## INT. COFFEE SHOP - DAY` |
| Action | *(plain text)* | `She enters, scanning the room.` |
| Character | `@` | `@ PRIYA` |
| Dialogue | *(line after @)* | `I've been waiting for you.` |
| Parenthetical | `( )` | `( whispering )` |
| Transition | `>>` | `>> CUT TO:` |
| Centered | `>> <<` | `>> TITLE CARD: 1987 <<` |
| Section | `#` | `# ACT ONE` |
| Note | `[[ ]]` | `[[ rewrite this scene ]]` |
| Comment | `<!-- -->` | `<!-- scratch draft below -->` |
| Page Break | `===` | `===` |
| Lyrics | `~` | `~ दिल है छोटा सा` |
| Scene synopsis | `&` | `& synopsis: Priya arrives at the café` |
| Scene metadata | `&` | `& status: wip` |

Scene headings support an optional ID anchor and metadata:

```
## INT. COFFEE SHOP - DAY {#scene-intro}
& synopsis: Priya arrives and spots the envelope.
& status: done
& location: Delhi
```

Documents may begin with YAML frontmatter:

```yaml
---
title: The Envelope
author: Sivaraj D
lang: hi
---
```

## Indic script support

Sutrata renders Hindi, Tamil, Telugu, Kannada, Malayalam, Bengali, Gujarati, Punjabi (Gurmukhi), and Odia via self-hosted Noto Sans font families (zero tofu guaranteed by a CI gate). Transliteration mode (`Ctrl+Shift+K`) lets you type romanised input that converts to native script on word boundaries — e.g. `namaste` → `नमस्ते`. Cursor movement follows UAX #29 grapheme clusters, so conjuncts and emoji sequences move as single units.

## Project structure

```
packages/
  parser/     Sutra reference parser — text ↔ AST, Fountain import/export,
              ISO 15919 transliteration. Zero UI dependencies.
  app/        React 18 + Vite + ProseMirror web app and Tauri renderer.
  tauri/      Thin Tauri v2 shell written in Rust.
```

## Development notes

- `@sutrata/parser` compiles with `tsc` before the app can import it. Run `pnpm --filter @sutrata/parser build` after changing parser source; `pnpm build` does this in order automatically.
- Tests: `pnpm --filter @sutrata/app test` (jsdom + vitest), `pnpm --filter @sutrata/parser test` (node + vitest), `pnpm --filter @sutrata/app test:e2e` (Playwright).
- The CI tofu gate (`node scripts/check-tofu.js`) fails if any required Indic script renders missing glyphs. Font `.woff2` files are not committed — see `packages/app/public/fonts/README.md` for the acquisition list.

## License

- `@sutrata/app`, `@sutrata/tauri` — [GPL-3.0-or-later](LICENSE)
- `@sutrata/parser` — [Apache-2.0](packages/parser/LICENSE)
- The [Sutra format specification](docs/sutra_format_spec.md) — [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)

Outside contributions require signing a CLA — see [CONTRIBUTING.md](CONTRIBUTING.md).
"Sutrata" and "Sutra" are trademarks of the project owner — see [TRADEMARKS.md](TRADEMARKS.md).
