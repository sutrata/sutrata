# Sutrata — Screenplay Writing Software (Open Source)
## Product Requirements & Technical Specification

**Version:** 3.0 Draft
**Status:** For Review
**License:** GPL-3.0-or-later (app, desktop shell) · Apache-2.0 (`@sutrata/parser`) · CC BY 4.0 (format spec) — see §1.7
**Target Audience:** Engineering, Product, Design Teams, Contributors
**Companion documents:**
- [Sutra Format Specification](sutra_format_spec.md) — normative for everything file-format related
- Sutrata Cloud — the commercial SaaS built on top of this app (internal roadmap, not published here)

> **Changes from v2.0.** This document now covers **only the open-source application**.
> Accounts, sync, managed AI, real-time collaboration, and production management moved to
> the Cloud spec. PDF export is back in P1 (client-side print pipeline; the planned backend
> PDF service is dropped). Basic BiDi is P1. Scene numbering, local version history, legacy
> font import, and Word import were added. A new §11.5 defines the extension points the
> Cloud product embeds through. Electron references were replaced by Tauri.
> Transliteration is now **one-way, Indic → Latin, at export only** (§5.8); Indic text is
> stored in native script when written in an Indic script, and the built-in Latin → Indic
> input methods were dropped.

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Core Screenplay Editing](#2-core-screenplay-editing)
3. [Sutra Format Support & File Operations](#3-sutra-format-support--file-operations)
4. [Indic & Unicode Script Support](#4-indic--unicode-script-support)
5. [Import & Export](#5-import--export)
6. [Voice Input](#6-voice-input)
7. [AI Integration (Bring Your Own Key)](#7-ai-integration-bring-your-own-key)
8. [Synopsis, Scene Synopses & Workflow Data](#8-synopsis-scene-synopses--workflow-data)
9. [Roadmap: Deferred Open-Source Features](#9-roadmap-deferred-open-source-features)
10. [Non-Functional Requirements](#10-non-functional-requirements)
11. [Architecture Overview](#11-architecture-overview)
12. [Appendix: Sutra Quick Reference](#12-appendix-sutra-quick-reference)

---

## 1. Product Overview

### 1.1 Vision

Sutrata is a free, open-source, professional screenplay writing application for
writers across languages and cultures. It provides a distraction-free authoring
environment built on **Sutra**, a Markdown-based plain-text screenplay format whose
element markup is language-neutral by design. A Tamil, Hindi, Arabic, or English
screenplay uses identical syntax. Sutrata integrates voice-to-script workflows and
captures the working documents that surround a screenplay (scene synopses, synopsis, shot
lists, workflow status) in the same file.

> **Why not Fountain?** Fountain detects screenplay elements from Latin-script conventions
> (ALL-CAPS character cues, `INT.`/`EXT.` scene prefixes) that do not exist in caseless
> Indic scripts. Sutra replaces detection with explicit, language-neutral structure
> while keeping industry conventions as recognized content. Fountain remains supported as
> an **import and export** format (export is lossy). See the format spec §1 and §13.

### 1.2 Scope Principle

> **If one writer needs it to write, format, translate, and deliver a script on their own
> machine, it belongs in open-source Sutrata. If it needs a server, more than one person,
> or production data, it belongs in Sutrata Cloud.**

The open-source app is **never deliberately crippled** to sell the Cloud product. It must
remain fully functional with no Sutrata server in existence.

### 1.3 Target Users

- Screenwriters, dialogue writers, and story writers for film, TV, and web series
- Regional-cinema writers working in Indic, Arabic, and other non-Latin scripts
- Independent and student filmmakers
- Film-school students and educators
- Tool builders adopting the Sutra format (via the parser package)

Production teams (ADs, production managers, producers) are served by Sutrata Cloud
(internal roadmap, not published in this repository).

### 1.4 Supported Platforms

- Web — Progressive Web App (primary) **[P1]**
- Windows, macOS, Linux desktop — Tauri v2 **[P1]**
- iOS and Android — Tauri v2 mobile, read + annotate + light edit **[P2]** (see §10.7)

### 1.5 Requirement Priorities

| Tag | Meaning |
|---|---|
| **[P1]** | MVP — required for first public release |
| **[P2]** | Fast-follow — first 6 months after launch |
| **[P3]** | Later — community or roadmap work, not scheduled |

Untagged statements inside a tagged subsection inherit the subsection's tag.

### 1.6 Success Criteria (launch)

- A writer can author a complete bilingual (e.g. Hindi + English) feature screenplay,
  with title page, scenes, dialogue, and scene synopses, entirely in Sutrata, and export
  a correctly shaped, text-selectable PDF and DOCX, **with the app offline end-to-end**.
- A `.sutra` file edited in Sutrata, then in a plain text editor, then in Sutrata
  again, loses no data (format-spec round-trip conformance).
- Editor remains responsive (per §10.1 budgets) on a 200-page script on a mid-range 2024
  laptop.
- Voice → AI → Sutra insertion produces a correctly structured scene from a 30-second
  Hindi or English dictation in ≥ 90% of test-suite utterances.
- Zero tofu (□) rendering for the §4.1 priority scripts in editor and PDF.
- **Zero proprietary backend:** the web app is static hosting plus user-supplied AI keys;
  desktop builds run fully standalone.

### 1.7 Licensing & Governance **[P1]**

| Component | License | Reason |
|---|---|---|
| `@sutrata/parser` | Apache-2.0 | Lets any tool adopt Sutra; format adoption is the goal. |
| Sutra format spec | CC BY 4.0 | Same. |
| `@sutrata/editor`, `@sutrata/app`, `@sutrata/tauri` | GPL-3.0-or-later | Prevents closed forks of the editor. |
| Bundled fonts | Their own licenses (OFL for Noto, Courier Prime) | Unchanged. |

- A `LICENSE` file per package and at the repository root is a release blocker.
- Outside contributions require a **Contributor License Agreement** (automated CLA check on
  pull requests). This keeps the project able to offer the editor under additional
  licenses, which the Cloud product depends on (Cloud spec §10).
- "Sutrata" and "Sutra" are trademarks of the project owner. Forks may use the code,
  not the names.

### 1.8 Resolved Design Decisions

| Decision | Choice |
|---|---|
| File format | Sutra (own spec); Fountain import **and** lossy export, both P1 |
| Editor core | ProseMirror (Monaco rejected: code-editor IME and shaping limits) |
| Parser | Custom TypeScript reference parser, published open source |
| PDF pipeline | **Client-side print pipeline**: paginated HTML rendered by the browser/WebView engine, printed to PDF. Platform shaping (HarfBuzz / CoreText / DirectWrite) handles Indic and Nastaliq. No backend. |
| Backend | **None.** The open-source app never requires a server. |
| Sync | Out of scope for the app itself. Files are plain text; users sync via any file tool. A storage-adapter extension point (§11.5) lets third parties, including Sutrata Cloud, add sync. |
| Page size | A4 **and** US Letter; A4 default (frontmatter `page:`) |
| AI provider | User-supplied key. Free tier (Groq or Google AI Studio) by default; Anthropic Claude and others configurable. Provider/model lists from a remotely updateable static config, never hardcoded. |
| Desktop shell | Tauri v2 |
| Romanization | **Indic → Latin (ISO 15919), applied only when exporting a romanized copy** (§5.8). The app has no Latin → Indic transliteration engine or input method (§4.3). Text writers type in Latin script, including informally romanized Hindi, is Latin text (§4.8). |

---

## 2. Core Screenplay Editing

### 2.1 Editor Requirements

The editor must behave as a purpose-built screenplay environment, not a general-purpose
rich text editor. **The plain-text `.sutra` file is the single source of truth**; the
editor's document model is derived from it and serializes back without loss (§3.1).

#### 2.1.1 Element Types **[P1]**

The editor must support all Sutra 1.0 elements (format spec §6–§8):

| Element | Sutra syntax |
|---|---|
| Scene Heading | `## heading {#id}` |
| Action | plain paragraph |
| Character Cue | `@नाम`, with extensions `(V.O.)` etc. |
| Dialogue | lines under a cue |
| Parenthetical | `( ... )` line inside dialogue |
| Dual Dialogue | `^` on second cue |
| Transition | `>> CUT TO:` |
| Centered Text | `>> text <<` |
| Lyrics | `~ line` |
| Scene Synopsis | `& synopsis: text` under scene heading |
| Scene Metadata | `& key: value` (actors, shots, status, number…) |
| Section (act/sequence) | `# heading` |
| Synopsis Section | `# … {#synopsis}` |
| Character Registry | `# … {#characters}` with `@`/`&` entries |
| Production Note | `[[ ... ]]` |
| Comment / Omitted | `<!-- ... -->` |
| Page Break | `===` |
| Title Page | YAML frontmatter |

Inline camera directions (`CLOSE ON:` …) are ordinary action; planned shots live in
`& shots:` metadata (format spec §6.11, §7.3).

#### 2.1.2 Smart Element Detection **[P1]**

- Pressing **Enter** after a Scene Heading offers Scene Synopsis or Action.
- Pressing **Enter** after an Action line offers Character or Action.
- Pressing **Enter** after a Character cue jumps to Dialogue.
- Pressing **Enter** after Dialogue offers Character, Parenthetical, or Action.
- Element switching inserts/removes the corresponding Sutra sigil; the writer never
  has to type `@` or `>>` manually (but may).
- Writers can always override via keyboard shortcut or toolbar.
- Tab/Shift-Tab cycles through element types.
- Detection works identically in all scripts: it is driven by sigils and position, never
  by casing or keywords.

#### 2.1.3 Keyboard Shortcuts **[P1]**

| Action | Windows/Linux | macOS |
|---|---|---|
| Scene Heading | Ctrl + 1 | Cmd + 1 |
| Action | Ctrl + 2 | Cmd + 2 |
| Character | Ctrl + 3 | Cmd + 3 |
| Dialogue | Ctrl + 4 | Cmd + 4 |
| Parenthetical | Ctrl + 5 | Cmd + 5 |
| Transition | Ctrl + 6 | Cmd + 6 |
| Scene Synopsis | Ctrl + 7 | Cmd + 7 |
| Toggle Note | Ctrl + / | Cmd + / |
| Bold / Italic / Underline | Ctrl + B / I / U | Cmd + B / I / U |
| Save | Ctrl + S | Cmd + S |
| Export | Ctrl + Shift + X | Cmd + Shift + X |
| Find | Ctrl + F | Cmd + F |
| Find & Replace | Ctrl + H | **Cmd + Opt + F** |
| Undo / Redo | Ctrl + Z / Ctrl + Y | Cmd + Z / Cmd + Shift + Z |
| Full Screen | F11 | Cmd + Ctrl + F |

> Cmd+H is reserved by macOS (Hide app) and must not be bound. All bindings
> user-remappable **[P2]**.

#### 2.1.4 Autocomplete **[P2]**

- Character names, locations, transitions, metadata keys.
- Non-intrusive suggestion UI (inline ghost text, not a blocking dropdown). A v1.0
  dropdown attempt interrupted typing and was removed.
- Grapheme-cluster matching for Indic scripts.

#### 2.1.5 Find & Replace **[P1]**

- Case-sensitive and case-insensitive modes (case-insensitivity is a no-op in caseless
  scripts and must not error).
- Replace across entire screenplay or within a selection.
- Unicode-correct: NFC-normalized matching, grapheme-cluster boundaries respected.
- Regex support; search by element type (e.g. only dialogue) **[P2]**.
- **Encoding-variant folding [P2]:** matching treats encodings that NFC does not unify
  as equal. First case: Malayalam chillu letters, where the atomic form (U+0D7A–0D7F)
  matches the older consonant + virama + ZWJ sequence (ൻ ≡ ന്‍). Replacement keeps the
  form found in the document.

#### 2.1.6 Scene Navigator **[P1]**

- Left-side panel lists all scene headings with their scene synopses and `& status:`
  badges.
- Click to jump to scene (formatted **and** source mode).
- Drag to reorder scenes: moves the entire scene block *including its metadata lines*;
  stable `{#id}`s and locked `& number:`s are never changed by reordering.
- Per-scene length indicator: estimated page count for Latin-script scenes;
  `& est-duration:` shown for all scripts. The navigator never shows page≈minute estimates
  for non-Latin text (§4.6).
- Color-coding by `& tags:`, location, time, or status **[P2]**.

#### 2.1.7 Page Layout **[P1]**

Latin-script pages follow industry-standard layout:

| Element | Left Margin | Right Margin | Width | Alignment |
|---|---|---|---|---|
| Scene Heading | 1.5" | 1.0" | 6.0" | Left |
| Action | 1.5" | 1.0" | 6.0" | Left |
| Character | 3.7" | — | — | Left |
| Parenthetical | 3.1" | 2.4" | — | Left |
| Dialogue | 2.5" | 2.5" | 3.5" | Left |
| Transition | — | 1.0" | — | Right |
| Page Number | — | 1.0" | — | Right (header) |

- **Page sizes:** A4 (default) and US Letter, per document (frontmatter `page:`). Margins
  are anchored to the left/top edge; the right margin absorbs the A4/Letter difference.
- **Latin font:** Courier Prime 12pt, bundled. Proprietary fonts are not bundled.
- **Complex scripts use proportional fonts, not monospace.** Each script uses its Noto
  face at a **calibrated size and leading** so a full line holds prose comparable to the
  60-character Courier line, with a fixed lines-per-page count. Calibration tables ship
  with the app (§4.6).
- **Page styles:** built-in styles (e.g. Hollywood standard, Traditional) and
  user-defined styles stored with the document or app settings.
- The 1 page ≈ 1 minute heuristic is shown **only** for Latin-script content, with a
  disclaimer.

#### 2.1.8 Multilingual Writing **[P1]**

- Language handling follows format spec §9: document default (frontmatter `lang:`),
  per-scene `& lang:`, auto-detection by Unicode script elsewhere.
- The editor applies per-language fonts, line-height, and line-breaking per block.
- Spell check runs per language, simultaneously for all languages present (§4.5), and is
  **toggleable per language**.
- A status-bar language indicator shows the effective language at the caret.
- Inline `{lang=…}` override tags **[P2]**, pending a format-spec decision on span versus
  block scope.

#### 2.1.9 Undo / Redo **[P1]**

- Unlimited undo within a session; undo history survives autosave.
- Undo operates on grapheme-cluster boundaries for text and on whole operations for
  structural changes (scene reorder, AI insertion, find & replace = one undo step each).

#### 2.1.10 Statistics **[P1]**

- Status bar: scene count, page count, word count, estimated duration.
- Statistics dialog: per-character line and scene counts, scenes per location, per-language
  word counts.

---

## 3. Sutra Format Support & File Operations

### 3.1 Specification Compliance **[P1]**

- Sutrata MUST conform to **Sutra 1.0** ([format spec](sutra_format_spec.md)) at
  the *editor/converter* conformance level (format spec §14): full element support,
  preservation of unknown metadata keys and attributes, and byte-faithful round-trip of
  untouched blocks.
- **The plain text is the source of truth.** The ProseMirror document model is a
  projection; opening + saving a file without edits produces a byte-identical file.
- **No script conversion on storage** (format spec §9.2). Text is stored in the script
  the writer used: Indic-script text as native Unicode, Latin-script text as Latin
  (§4.8). Romanized copies are an export option (§5.8).

### 3.2 File Operations **[P1]**

- **Open / Save:** native format is `.sutra`. No proprietary lock-in.
- **Auto-save:** debounced, default every 30 seconds, to local storage (IndexedDB on web,
  disk on desktop); configurable.
- **New from Template:** Sutra templates for Feature Film, TV Pilot, TV Episode, Short
  Film, Web Series, Stage Play, in English and in the §10.5 UI languages.

### 3.3 Editing Modes **[P1]**

- **Formatted mode (default):** WYSIWYG-style screenplay view; sigils hidden or subdued,
  metadata foldable.
- **Source mode:** raw Sutra text with syntax highlighting.
- Both modes edit the same underlying text; switching is instant and lossless.
- Notes (`[[…]]`), scene synopses, and `&` metadata render in a collapsible inline style
  and in side panels (§8).

### 3.4 Title Page **[P1]**

- Frontmatter editing via source mode, inline fields on the title-page card, and a
  **sectioned title page form**. The form opens from the app bar or the card's "Edit
  title page" button, and has six sections:
  - *Title & Story:* title, titles in other languages (language dropdown plus text), and
    logline with a live word count (target 30 words, warning above 50).
  - *Credits:* written by, credit line, based on, and separate story, screenplay, and
    dialogue credits.
  - *Draft:* draft, revision, and date. The date uses a **date picker** that writes
    ISO `YYYY-MM-DD`. A date already written as free text stays editable as text, with
    a switch to the picker.
  - *Contact & Rights:* multi-line contact and copyright.
  - *Document Settings:*
    - primary language and other languages, both from a **language dropdown**;
    - page size (A4 or US Letter);
    - screenplay style, from a **style dropdown** of built-in and custom styles;
    - watermark.
  - *Other Fields:* simple custom keys as editable key and value rows.
- Saving rewrites only the frontmatter keys whose value changed. Unknown keys, nested
  maps, ordering, and formatting are kept byte for byte, so saving without edits leaves
  the file unchanged. Keys with multi-line or nested values that the form does not
  manage are listed as kept, and can be edited in source mode.
- In formatted mode the save is a single editor transaction, so one undo reverts it.
- All reserved frontmatter keys (format spec §5) supported; custom keys preserved.
- Multilingual `title:` maps render the `lang`-matching title with others as subtitles.
- Indian-industry credit conventions supported as reserved or custom keys: separate
  **story**, **screenplay**, and **dialogue** credits.

### 3.5 Local Version History **[P2]**

- On every manual save, a timestamped snapshot: desktop in a `<name>.sutra.versions/`
  directory; web in an IndexedDB store. Default retention 50 versions, configurable.
- Version browser with preview, **scene-level diff** (by stable scene ID), and restore.
- Named snapshots ("Draft 2 – sent to producer").

### 3.6 Scene Numbering and Omitted Scenes **[P2]**

Revision mode (colored revision sets, revision marks and margin stars, page locking with
A-pages, revised-page distribution) is a **Sutrata Cloud** feature (§9.4). Its data is kept
by Cloud outside the `.sutra` file and is not part of the Sutra format; downloadable
revision data may be designed later, once the workflow is settled.

The open-source app covers the parts every numbered draft needs (Sutra format spec §6.1,
§7.4):

- Scene numbers live in `& number:`, separate from the stable `{#id}`.
- **Renumber scenes** is a user-requested action, never automatic: an inserted scene takes
  the next number and later scenes shift up by one, keeping letter suffixes; inside a
  lettered run the inserted scene takes the next letter (`20A`, new, `20B` → `20A`,
  `20B`, `20C`).
- The scene navigator highlights missing, duplicated and out-of-order numbers until the
  writer renumbers.
- **Omit scene** keeps the heading and number with `& status: omitted`; exports print
  "OMITTED".

---

## 4. Indic & Unicode Script Support

### 4.1 Scope **[P1]**

Full Unicode 15.x repertoire, with **first-class support** for:

**Indic scripts (priority):** Devanagari (Hindi, Marathi, Sanskrit, Konkani, Nepali),
Tamil, Telugu, Kannada, Malayalam, Gujarati, Gurmukhi (Punjabi), Odia, Bengali, Sinhala,
Urdu (Nastaliq, RTL).

**Additional script families [P2 unless noted]:** Arabic / Persian / Pashto (RTL)
**[P1]**, Latin Extended **[P1]**, Hebrew (RTL), CJK (Simplified & Traditional Chinese,
Japanese, Korean), Thai, Burmese, Khmer, Ethiopic, Georgian, Armenian.

### 4.2 Text Rendering **[P1]**

- **Shaping:** browser/WebView-native text stack for editing and for PDF output (§5.1).
  The platform's shaping engine handles conjuncts, vowel-sign positioning, and Nastaliq.
- **BiDi:** each block renders with `dir="auto"` so RTL paragraphs lay out correctly and
  mixed LTR/RTL runs follow the Unicode Bidirectional Algorithm as implemented by the
  browser **[P1]**. Mirrored page layout for RTL-primary documents and hardening of cursor
  movement across direction boundaries **[P2]**.
- **Line breaking:** browser-native per script; never inside a grapheme cluster.
  Dictionary-based segmentation for Thai, Khmer, Burmese comes from the browser **[P2]**.
- **Cursor movement and selection:** grapheme-cluster-aware per UAX #29 via
  `Intl.Segmenter`.

### 4.3 Input Methods **[P1]**

- Respect the OS IME for all scripts; on web, full
  `compositionstart / compositionupdate / compositionend` support, validated in CI against
  Devanagari, Tamil, Japanese, and Korean IMEs.
- Native-script entry comes from the OS or a system IME (for example Windows and macOS
  Indic keyboards, Google Indic Keyboard, phonetic IMEs), or from voice input (§6).
  Sutrata ships **no built-in Latin → Indic input method**; the earlier ISO 15919 and
  ITRANS input modes were dropped to reduce complexity.
- Onboarding links to recommended keyboards per language and platform.

### 4.4 Font Handling **[P1]**

- Bundle **Noto Sans** and **Noto Serif** families (all §4.1 Indic scripts), **Noto
  Nastaliq Urdu**, and **Courier Prime**.
- Screenplay page view: Courier Prime for Latin; the appropriate proportional Noto face
  for each complex script at calibrated metrics (§2.1.7). CJK uses Source Han Sans/Mono.
- Font fallback chain guarantees no tofu (□) for §4.1 scripts; the tofu gate runs in CI.
- **Latin fallback: Noto Sans.** It is the fallback for any Latin character the style's
  own font lacks, and it renders romanized export (§5.8). The bundled Noto Sans Latin file
  is subset from the full font and MUST include Latin Extended-A/B (U+0100–024F),
  Combining Diacritical Marks (U+0300–036F), and Latin Extended Additional
  (U+1E00–1EFF), with base letters and combining marks in the same file so mark
  positioning works (r̥, l̥, m̐). CI checks the bundled file's character map, not just
  system fonts. If a font update drops a range, the font is re-subset from the full
  source.
- Styles whose body font is **Noto Serif** keep Noto Serif for romanized text; Noto Serif
  carries the ISO 15919 diacritics itself.

### 4.5 Spell Check

- **Hunspell** (WASM on web, native or WASM on desktop) dictionaries: English, Hindi,
  Tamil, Telugu, Malayalam, Kannada, Bengali, Gujarati, Punjabi, Marathi, Odia **[P1]**;
  Urdu, Sinhala **[P2]**.
- Dictionaries are downloaded on demand, not bundled, to keep the install small.
- Dictionary quality varies widely for Indic languages. Weak dictionaries default **off**
  and are labeled as such.
- Per-project custom dictionary (character and place names are auto-added from the
  registry and scene headings) **[P1]**.
- Simultaneous multilingual checking driven by §2.1.8 language resolution **[P1]**.

### 4.6 Length & Duration Model **[P1]**

- **Latin script:** classic 60-char Courier line, ~55 lines/page; page count and
  page≈minute shown with the standard disclaimer.
- **Complex scripts:** fixed lines-per-page per calibrated layout (§2.1.7); page counts
  come from the layout engine, but **no automatic page→minute conversion is shown**.
  Duration comes from `& est-duration:` per scene (writer-entered; AI can suggest, §7.3),
  summed in the navigator and reports.
- Mixed-script documents paginate correctly because pagination always comes from actual
  layout, not character counts.

### 4.7 Mixed-Script Documents **[P1]**

Per format spec §9.3: scripts mix freely; per-block auto-detection chooses
font/line-height/breaking; tags override where detection is insufficient.

### 4.8 Latin-Script Text in Any Language **[P1]**

Writers may type any language in Latin script, for example Hindi dialogue written as
"Main kal aaunga". This is common in Hindi-film scripts and is usually informal, not
ISO 15919.

- Such text is **Latin text**, handled exactly like English: Latin fonts, Latin line
  breaking, and no transliteration in either direction.
- Script detection classifies it as Latin. English spellcheck will flag the words; the
  writer can turn English spellcheck off for the document or add words to the project
  dictionary.
- Romanized export leaves it unchanged (§5.8).

---

## 5. Import & Export

### 5.1 PDF Export **[P1]**

- Produced by the **client-side print pipeline**: the AST is rendered to paginated HTML
  with the selected page style, then printed to PDF by the browser (web) or a hidden
  WebView (desktop). Implemented in the app's print adapter and paginator.
- Because the platform text engine shapes the text, Indic conjuncts, Nastaliq, and BiDi
  are correct in the PDF, and text remains selectable.
- Per-page headers: page numbers, `CONTINUED` markers, and scene numbers are placed by the
  app's own paginator, not by browser print margins.
- Options: page style, include/exclude notes, include title page, scene numbers on
  left/right/both, romanized output (§5.8), watermark text **[P2]**.
- Known limitations (documented in the export dialog): no PDF/A guarantee; font
  embedding and subsetting are controlled by the platform.

### 5.2 DOCX Export **[P1]**

#### 5.2.1 Style Mapping

Every Sutra element maps to a named Word style so recipients can restyle:

| Sutra element | Word style |
|---|---|
| Scene Heading | `Screenplay Scene Heading` |
| Action | `Screenplay Action` |
| Character Cue | `Screenplay Character` |
| Dialogue | `Screenplay Dialogue` |
| Parenthetical | `Screenplay Parenthetical` |
| Transition | `Screenplay Transition` |
| Section | `Heading 1` (deeper sections → `Heading 3+`) |
| Scene Synopsis | `Screenplay Scene Synopsis` |
| Note | `Screenplay Note` |
| Lyrics | `Screenplay Lyrics` |

#### 5.2.2 Technical Notes

- **docx** npm library; page size A4 or Letter with explicit margins.
- `w:rFonts` per run with `w:cs` (complex script) and `w:eastAsia` attributes so Word
  picks correct fonts per script; fonts referenced, not embedded.
- Dual dialogue via two-column table.
- Romanized output option (§5.8).

### 5.3 Workflow Document Exports **[P1]**

Generated from `=` scene synopses and `&` metadata:

- **One-liner schedule / scene breakdown:** scene number, heading, synopsis, actors,
  status, est-duration. PDF, DOCX, CSV/XLSX.
- **Shot list:** per-scene `& shots:` items with scene IDs/numbers and actors. PDF,
  CSV/XLSX.
- **Character/cast report:** registry plus per-character scene counts and the scenes'
  metadata.

These are single-file, read-only reports. Scheduling, breakdown databases, and call
sheets are Cloud features.

### 5.4 Fountain Interoperability **[P1]**

- **Import:** open `.fountain` files (including Final Draft, Highland, Slugline exports)
  using the mapping in format spec §13. Lossless for well-formed Fountain; anything
  unrecognized becomes action text plus a warning report.
- **Export:** save a Fountain copy, with explicit lossy-export warnings (metadata, language
  tags, registry → `[[notes]]` or dropped, per format spec §13).

### 5.5 Word and Text Import (AI-assisted) **[P2]**

- Round-trip import of DOCX files exported by Sutrata (by style name), without AI.
- **AI-assisted import of arbitrary screenplays** (`.docx` from any source, `.txt`, `.md`,
  or pasted text): text is extracted with paragraph boundaries and bold/italic/underline,
  split into chunks at likely scene boundaries, and formatted as Sutra by the injected
  `AIProvider` with a prompt that forbids translating, summarising, or adding text.
- Every chunk is checked: its output must parse, and its words (NFC, sigils ignored)
  must match the source; a failing chunk is retried once and otherwise flagged.
- The provider's data-policy text is shown and must be accepted before anything is sent.
  Unavailable without an `AIProvider` or in a read-only session.
- The writer reviews a side-by-side preview, corrects element types per block, and
  imports by replacing the script (title page kept) or appending — one undoable edit.

### 5.6 Legacy Font Encoding Conversion **[P2, on hold]**

Many Indian film scripts are typed in pre-Unicode fonts that map native glyphs onto Latin
code points. Opening them without conversion shows Latin gibberish.

- Detect and convert to Unicode: **Krutidev** and **Shree-Lipi/Chanakya** (Devanagari),
  **Bamini / TAM / TAB** (Tamil), **Anu** (Telugu), **Nudi / Baraha** (Kannada),
  **ML-TT / Karthika** (Malayalam) — priority order Hindi, Tamil, Telugu, then others.
- Works on pasted text and on Word import (the run's font name identifies the encoding).
- Conversion tables live in the parser package (pure data + functions, no UI dependency)
  so other tools can use them; each table has a round-trip conformance corpus.

### 5.7 Additional Export Formats **[P3]**

- **FDX** (Final Draft interop, import and export) · **HTML** (web publication) · **Plain
  text** (markup stripped) · **ePub**.

### 5.8 Romanized Export **[P1]**

For collaborators who speak the language but can't read its script (actors, crew from
another region, co-producers), PDF and DOCX export can output a **romanized copy**.
Romanization is purely an app output feature; the Sutra format only requires that
Indic text is stored in native script (format spec §9.2).

#### 5.8.1 Rules

1. **One way only: Indic → Latin**, applied to the export or print preview. The `.sutra`
   file is never changed. Romanized export is a whole-document rendering step and has no
   reverse (Latin → Indic) counterpart. It is unrelated to how writers enter text:
   keyboards, IMEs, and the AI voice formatter (§7.2.2) are separate features.
2. **Scheme: ISO 15919.** Supported scripts: Devanagari, Tamil, Telugu, Kannada,
   Malayalam, Bengali, Gujarati, Gurmukhi, Odia, Sinhala. Scripts outside
   ISO 15919 (Perso-Arabic Urdu, Arabic, CJK, and others) pass through unchanged.
3. **Only Indic letters and signs are converted.** Latin text, ASCII digits, punctuation,
   Sutra sigils, and markup are left untouched. Native digits convert to ASCII digits.
   Danda (।) and double danda (॥) convert to `.` and `..`.
4. **Script is detected per run** from each character's Unicode script. Combining marks,
   ZWJ, and ZWNJ belong to the preceding run. Mixed-script lines therefore convert
   correctly with no language tags.
5. **Not reversible.** Output never feeds back into storage, so no round-trip guarantee
   applies.
6. **Variant, one of two:**
   - **Strict** (default): ISO 15919 with diacritics. Every inherent vowel is kept
     (राम → *rāma*), and `:` separates would-be digraphs (अइ → *a:i*, क्ह → *k:h*).
   - **Casual**: no diacritics at all — the informal spelling people actually type
     (SMS/chat style), e.g. राम → *raam*, संगीत → *sangeet*, मीरा → *meeraa*,
     விக்ரம் → *vikram*. For languages that drop it, the word-final inherent vowel is
     omitted in words of two or more syllables unless the final consonant closes a
     conjunct (राम → *raam* keeps its vowel sign; मित्र → *mitra*, न → *na* keep the
     conjunct-final vowel); Indo-Aryan ē/ō are written as a single e/o (मोहन → *mohan*).
     It also uses ASCII digraphs (sh, ng, ny, zh), doubled ee/oo for long ī/ū, and, for
     Tamil only, the documented voiced/voiceless alternation of க/ட/ப and the ச (s/ch)
     and த (always "th") conventions described in §5.8.1b. Dravidian languages,
     Sanskrit, and Odia keep every vowel. This is a deterministic, documented rule set,
     not a reproduction of any specific commercial tool: statistical transliteration
     engines can spell the same letter differently in different words, and that behavior
     cannot be reverse-engineered from a handful of examples.
   - The rules for a run come from the first language in frontmatter `lang` then
     `lang-secondary` that is written in the run's script, else the script's default
     language (Devanagari → Hindi, Tamil script → Tamil, and so on).
   - A notice at the top of the export states the scheme and the variant, e.g.
     "ROMANIZED COPY · casual".
   - Internally the engine also has a **readable** mode (ISO 15919 with diacritics, but
     with casual's word-final vowel-drop and no `:` separators). It is what casual is
     built on, and what character names use under strict export (rule 7), but it is not
     offered as a separate export choice, to keep the option list to two.
7. **Character names follow the primary language's convention** in every variant. Cue
   names and names from the character registry are romanized in the engine's readable
   mode under strict export, and fully casual under casual export, and title-cased, so
   विक्रम prints as *Vikram* either way (never *vikrama*). The same rendering is used
   wherever the exact name appears as a whole word in action, dialogue, or metadata, so a
   name is spelled one way throughout the export. Exporters may still uppercase cues per
   the page style.
   - **[Pending]** The vowel-drop rule only omits the *word-final* inherent vowel. There
     is no full Hindi (or other Indo-Aryan language) schwa-deletion rule set, which also
     drops vowels mid-word by syllable weight (e.g. रेलवे should read *relve*, not
     *relave*; समझना should read *samajhnā*/*samajhna*, not *samajhanā*/*samajhana*).
     Until a proper rule set is implemented, output for such words is phonetically
     approximate.
8. **Latin-script text is never romanized.** Text the writer typed in Latin, including
   informally romanized Hindi or Tamil, passes through exactly as written (§4.8).

#### 5.8.1a Pagination

Romanized exports paginate differently from the native-script original, so their page
numbers do not match a locked script's pages. Preserving native page breaks in romanized
output is a Sutrata Cloud feature (Cloud spec §9.4).

#### 5.8.1b Tamil voicing in the casual variant

Tamil writes what are, phonetically, voiced/voiceless consonant pairs with one letter
each, and casual typists resolve the ambiguity by position rather than by picking one
spelling per letter. The casual variant reproduces the well-documented pattern:

- **க, ட, ப** are voiceless (*k*, *t*, *p*) word-initially, when doubled (geminated), or
  written bare (virama, no vowel); voiced (*g*, *d*, *b*) elsewhere — chiefly
  intervocalically and after a nasal (குடும்பத்தில் → *kudumbaththil*, with the nasal-led
  ப voiced as "mb").
- **ச** is "s" except when bare or doubled, where it is "ch" (சேவை → *sevai*, பொதுச் →
  *pothuch*).
- **த** is always "th", kept distinct from **ற**, which is "t" bare and "tr" with a
  vowel (முற்றுகை → *muttrugai*).

This does not extend to Telugu, Kannada, or Malayalam, which already have separate
letters for voiced and voiceless consonants and so have no such ambiguity.

#### 5.8.2 Options

- **Scope:** *all text* (including the title page), or *dialogue only*: character cues,
  parentheticals, dialogue, and lyrics are romanized; the title page, headings, action,
  metadata, and the character registry stay in native script.
- **Variant:** strict or casual (rule 6).
- The option appears for PDF and DOCX export when the document contains Indic text. The
  output file name gets a `_romanized` suffix.
- The romanized copy replaces the native text; there is no side-by-side or interlinear
  layout.
- **Workflow reports** (one-liner schedule, shot list, cast report) offer the same
  romanized option, with all text romanized and the chosen variant. Report file names
  get the same `_romanized` suffix. Reports carry no page-reference notice, since they
  have no screenplay pagination.

#### 5.8.3 Implementation

- `@sutrata/parser` exports `romanize(text, options)` (string → string) and
  `romanizeSutra(source, options)`. The second romanizes a whole Sutra source,
  applies the scope, name, and notice rules, and returns valid Sutra. The exporters
  parse that copy and render it like any document, so no exporter needs romanization
  logic of its own. Neither function has UI dependencies.
- The nine scripts share the ISCII-derived Unicode block layout, so one table keyed by the
  offset inside each block covers them all, with per-script overrides (Tamil āytam,
  Malayalam chillu and dot reph, Bengali khanda ta, Gurmukhi tippi, addak and vowel
  bearers, Kannada ḻa, Telugu ts/dz).
- Tested against native input with expected ISO 15919 output for every script, covering
  nukta forms (precomposed and decomposed), Malayalam chillu (atomic and ZWJ forms),
  Tamil ṉ/ṟ/ḻ, anusvara/visarga/candrabindu, digits and dandas, mixed-script lines, both
  variants, and the Sutra-level scope, name, and notice rules.
- The existing Latin → Indic `transliterate()` function remains in the parser, unused by
  export, pending a later decision.

---

## 6. Voice Input

### 6.1 Modes **[P1]**

1. **Dictation Mode:** raw speech-to-text at the cursor, with punctuation commands.
2. **Guided Dictation Mode:** writer speaks content and structure ("scene heading:
   interior coffee shop, day"); AI formats to Sutra (§7.2).

### 6.2 Speech Recognition Engines

The UI must show which engine is active and why.

| Tier | Engine | Platforms | Notes |
|---|---|---|---|
| **[P1]** Cloud, BYO key | Hosted Whisper: **Groq free tier** (same key as the default LLM, §7.1) or OpenAI Whisper API | All | Best Indic accuracy; requires network + explicit privacy consent (§10.4). Direct client→provider call. |
| **[P1]** Browser | Web Speech API | Chrome/Edge/Safari where available | **Privacy caveat surfaced in UI: Chrome's implementation sends audio to Google's servers.** Inconsistent for Indic; offered, never default, for Indic. Unavailable in Firefox. |
| **[P2]** Local | whisper.cpp via a Tauri native plugin | Desktop | Offline + private. Model sizes adequate for Indic accuracy are not realistic in WASM on mid-range hardware; a small-model WASM mode may ship as experimental. |

#### 6.2.1 Voice Languages

**[P1]:** English (en-US, en-GB, en-IN), Hindi, Tamil, Telugu, Malayalam, Kannada,
Bengali, Gujarati, Marathi, Punjabi.
**[P2]:** Urdu, Arabic, Mandarin, Spanish, French, German; more per Whisper availability.

### 6.3 Voice Commands **[P1]**

- Formatting commands ("new scene", "character …", "dialogue", "note …", "undo",
  "delete that", "stop listening").
- **Escape mechanism:** a reserved phrase (e.g. "literal …") forces the next utterance to
  be inserted as content.
- Command words are configurable to avoid collisions with character names.
- **Localized command vocabulary [P2]:** per-language command tables for Tamil, Hindi,
  Telugu, Kannada, Malayalam, Bengali, Gujarati, Marathi, Punjabi, Odia; user-extensible.

### 6.4 Interaction **[P1]**

- Push-to-talk (configurable key) and continuous-listening toggle; waveform indicator
  while the microphone is open.
- Interim results shown ghosted; final transcription committed per utterance; writer
  confirms or discards before AI processing (or enables auto-insert, §7.2.3).

---

## 7. AI Integration (Bring Your Own Key)

### 7.1 Overview **[P1]**

AI features run on a configurable, multi-provider LLM client, called **directly from the
client with the user's own key**. The open-source app never proxies AI calls. (A managed,
no-key option is a Cloud feature, delivered through the AI-provider extension point,
§11.5.)

- **Small models are sufficient for the core task, by design.** The main AI job (§7.2) is
  narrow: transcript → Sutra, with a strict system prompt, few-shot examples per
  language, and parser-gated output (invalid Sutra is rejected and retried). The §7.2.2
  evaluation suite gates which models are enabled per feature and per language.
- **Provider tiers:**
  1. **Free (default):** Groq or Google AI Studio key. Covers voice-to-Sutra, "format
     as screenplay", and scene-synopsis generation. Groq also hosts Whisper STT on the
     same key.
  2. **Premium BYO key:** Anthropic Claude or other configured providers for
     quality-sensitive features.
  3. **Local models [P3]:** OpenAI-compatible local endpoints (e.g. Ollama, llama.cpp
     server) on desktop.
- **Models and providers are configuration, not code:** the app fetches its
  provider/model list from a remotely updateable static config file (CDN, not a backend),
  using alias IDs only, never dated snapshot IDs. Retiring or adding a model requires no
  app release.
- **Free-tier caveats, surfaced in the UI:** free tiers are rate-limited and some may use
  submitted content for training. Sutrata shows each provider's data policy at key
  setup and recommends a paid or zero-retention tier for unreleased scripts.

### 7.2 Voice-to-Sutra Formatting **[P1]**

#### 7.2.1 Pipeline

```
Voice Audio
    ↓  speech engine (§6.2)
Raw transcript
    ↓  pre-process: punctuation normalization, filler-word removal
Cleaned transcript
    ↓  LLM (provider/model from config)
Sutra markup
    ↓  Sutra parser: validate + sanitize (structural check; never mutates script text)
Editor insertion (after confirmation, §7.2.3)
```

#### 7.2.2 System Prompt Requirements

The system prompt instructs the model to:

1. Identify screenplay elements from unstructured narration and emit **only valid
   Sutra** (sigil-based: `##`, `@`, `>>`, `=`, `&`), never Fountain, never commentary.
2. Mark character cues with `@`; **never rely on or require ALL CAPS**. Preserve the
   writer's casing for Latin names.
3. Infer `& setting:`, `& location:`, `& time:` from context; keep the heading text in the
   writer's language.
4. Preserve dialogue verbatim.
5. Handle code-switching: mixed Hindi-English dictation produces mixed Sutra with
   correct Unicode for each run.
6. Write Indic-language speech in the language's native script by default, even if the
   speech engine returned Latin text. This is part of the AI's formatting job (choosing
   how dictated words are written), not the romanized-export feature of §5.8.
7. If element type is uncertain, prefer action.

The prompt is a versioned artifact in the repo with an evaluation suite (≥ 200 dictation
transcripts across languages) gating prompt changes.

#### 7.2.3 Confirmation UI

- Diff view: transcript left, proposed Sutra right (formatted preview).
- Accept all / reject all / edit before accept.
- Optional "always auto-insert" with per-session revert.

### 7.3 Additional AI Features

All run on the user's own key, always as suggestions the writer confirms.

| Feature | Priority | Behavior |
|---|---|---|
| **Format as Screenplay** | P1 | Convert selected raw text (notes, emails, treatments) to Sutra. |
| **Scene synopsis generation** | P1 | Per scene or "generate all missing"; writes `& synopsis:` lines in the screenplay's language. |
| **Logline suggestion** | P1 | From the synopsis or full script. |
| **est-duration suggestion** | P2 | Estimates `& est-duration:` from scene content. |
| **Character extraction** | P2 | Builds/updates the `{#characters}` registry; detects aliases and proposes `& aliases:` entries. |
| **Dialogue polish** | P3 | Writer-initiated, suggestion-only, never auto-applied. |
| **Translation assist** | P3 | Translates selected elements between supported languages, Sutra structure intact; writer merges manually. |
| **Continuity check** | P3 | Flags injury/time/prop continuity issues with scene references; uses `& story-day:`. |

### 7.4 AI Configuration & Privacy **[P1]**

- **API keys:** guided onboarding (provider console link, paste key, validation call).
  Keys are sent only to their own provider, directly from the client. Storage: desktop:
  OS keychain; web: in memory / `sessionStorage` by default, with an explicit
  informed-consent toggle for persistent on-device storage. Never silently persisted.
- **Disclosure:** first use of any AI feature shows exactly what text leaves the device and
  to whom; per-feature opt-in.
- **Token budget:** configurable max tokens per call; running usage meter.
- **Offline:** AI features disabled with a clear banner; everything else works.

---

## 8. Synopsis, Scene Synopses & Workflow Data

### 8.1 Definitions **[P1]**

| Term | Meaning | Where it lives |
|---|---|---|
| **Logline** | One-sentence premise of the whole film. Target ≤ 30 words; warning above 50. | Frontmatter `logline:` |
| **Scene Synopsis** | One-sentence summary of a single scene (the industry "one-liner"). The set of all scene synopses is the one-liner schedule. | `=` line per scene |
| **Synopsis** | 1–3 paragraph (short) to multi-page (full) prose telling of the story. | `{#synopsis}` section |
| **Step Outline** | Beat sheet linked to scenes. | `#`/`###` sections + scene synopses |
| **Shot List** | Planned shots per scene. | `& shots:` per scene |

### 8.2 Logline **[P1]**

- Dedicated frontmatter field with live word count (≤ 30 target / 50 warn).
- Optionally printed on the title page.

### 8.3 Scene Synopsis Panel **[P1]**

- Sidebar listing every scene with its `=` synopsis; placeholders for scenes lacking one.
- Editing in the panel writes directly to the `.sutra` text.
- "Generate all missing" via AI (§7.3).
- Exports as the one-liner schedule (§5.3).

### 8.4 Synopsis View **[P1]**

- Distraction-free reading/editing view of the `{#synopsis}` section, plus Title +
  Logline + all scene synopses as a "story at a glance" mode.
- Exportable standalone (PDF/DOCX).

### 8.5 Beat Board **[P2]**

- Card view of all scenes: number, heading, scene synopsis, actors, tags, status.
- Drag to reorder (same invariants as §2.1.6).
- Color by act/section, tag, or status; list ⇄ card toggle.

### 8.6 Workflow Metadata UI **[P1]**

- Form-style scene inspector for reserved keys (`status`, `actors`, `number`,
  `story-day`, `tags`, `est-duration`) writing `&` lines.
- Shot-list editor (add/reorder/edit `& shots:` items).
- Custom keys editable as free key-value rows, round-trip-safe per the unknown-key rule.
- **Scene number locking:** an explicit "lock scene numbers" action assigns `& number:`
  to all scenes; thereafter insertions get letter-suffixed numbers (12A) and reordering
  never renumbers.

---

## 9. Roadmap: Deferred Open-Source Features

Items tagged P2/P3 elsewhere in this document are the open-source roadmap. Additionally:

### 9.1 Plugin System **[P3]**

- Third-party plugins built on the §11.5 extension points, loaded from user-installed
  packages.
- Sandboxed: iframe on web, isolated WebView on desktop; plugins get the AST and a
  restricted command API, never raw filesystem or network without a permission prompt.

### 9.2 Accessibility Hardening **[P2]**

- WCAG 2.1 AA audit with NVDA, JAWS, VoiceOver.
- Dyslexia-friendly font options beyond OpenDyslexic.

### 9.3 Internationalization Expansion **[P2]**

- UI languages: Urdu (RTL UI), Punjabi, Odia, then community-contributed locales.
- RTL UI mirroring for Urdu and Arabic.

### 9.4 Moved to Sutrata Cloud

These v2.0 items moved to the Sutrata Cloud roadmap (internal, not published in this repository):

- Accounts, cloud sync, cloud version history, share links
- Managed AI (no-key access, spend caps) and whole-project AI (auto-breakdown)
- Real-time collaboration, comments, roles
- Revision mode: colored revision sets, revision marks and stars, page locking with
  A-pages, revision distribution and crew acknowledgment (data kept by Cloud, outside the
  `.sutra` file)
- Breakdown, scheduling/stripboard, call sheets, budgeting, cast & crew, locations,
  storyboards
- Server-side PDF rendering: **dropped** (§5.1 covers PDF client-side)

---

## 10. Non-Functional Requirements

### 10.1 Performance **[P1]**

| Metric | Budget |
|---|---|
| Keystroke → screen (200-page script) | < 16 ms p95 |
| Incremental re-parse per edit | < 5 ms p95 |
| Open 120-page script | < 2 s on mid-range 2024 hardware |
| PDF export, 120 pages (print pipeline, to print dialog) | < 10 s |
| Voice → AI formatting round trip (30 s utterance) | < 5 s on broadband |
| Scene navigator / panels refresh after edit | < 100 ms |

### 10.2 Accessibility **[P1]**

- Screen-reader element-type announcements.
- High-contrast mode; full keyboard-only operation of all core functions.
- Dyslexia-friendly font option (OpenDyslexic) in editing view (page preview keeps
  production fonts).
- Full WCAG 2.1 AA audit before P1 sign-off; hardening in §9.2.

### 10.3 Offline Support **[P1]**

- Fully functional offline (PWA service worker; desktop inherently): editing, parsing,
  PDF/DOCX/workflow export (including romanized export), spellcheck, legacy-font
  conversion.
- Offline-unavailable: cloud AI and cloud speech, each with a clear banner, never a broken
  control.

### 10.4 Data & Privacy **[P1]**

- **Local-only:** scripts live on-device. The app makes no network requests except to (a)
  the static provider-config CDN, (b) AI/speech providers the user configured, and (c)
  dictionary/font downloads. No telemetry without opt-in.
- Sharing is file-based: `.sutra` files are plain text and travel over email, drives, and
  git.
- **AI data flow:** §7.4 disclosure; provider data policy linked in-app.
- **Voice data flow:** §6.2 engine-specific disclosures (Google for Web Speech, the chosen
  provider for hosted Whisper, nothing leaves the device for local).

### 10.5 Internationalization (UI)

- UI languages at launch **[P1]:** English, Hindi, Tamil, Telugu, Malayalam, Kannada,
  Bengali, Gujarati, Marathi. English + Hindi + Tamil + Telugu are release-blocking;
  others may ship community-reviewed.
- Strings externalized to JSON locale files (including toolbar tooltips); locale-correct
  dates and numbers.

### 10.6 Security **[P1]**

- API key handling per §7.4.
- Strict CSP; no remote-code-execution surface.
- Dependency audit + SCA in CI; Tauri hardening (minimal capability allow-list, no
  arbitrary shell or filesystem scope, CSP enforced in WebView).

### 10.7 Mobile **[P2]**

- Tauri v2 mobile builds for iOS and Android.
- Scope: open, read (formatted + page view), annotate with notes, light editing, export
  PDF.
- ProseMirror composition handling on Android keyboards (Gboard, Indic keyboards) is a
  known risk; each supported keyboard is tested on real devices before editing is enabled
  for that script.

---

## 11. Architecture Overview

### 11.1 Packages

| Package | Role | License |
|---|---|---|
| `@sutrata/parser` | Sutra reference implementation: text ↔ AST, Fountain import/export, Indic → ISO 15919 romanization, legacy-font conversion. Zero UI deps. Published to npm. | Apache-2.0 |
| `@sutrata/editor` **[P1 refactor]** | Reusable React library: `DocumentContext`, ProseMirror editor, panels, exporters, i18n, and the §11.5 extension points. Published to npm. | GPL-3.0-or-later |
| `@sutrata/app` | Thin standalone shell: wires `@sutrata/editor` with local storage, BYO-key AI, and app chrome. Builds the PWA and the Tauri renderer. | GPL-3.0-or-later |
| `@sutrata/tauri` | Tauri v2 shell (Rust): native dialogs, keychain, filesystem, print window. | GPL-3.0-or-later |
| `@sutrata/extension-testkit` **[P1]** | Stub embedder implementing every §11.5 extension point; runs as the extension contract test in CI. | GPL-3.0-or-later |
| `@sutrata/cloud-connector` **[P2, optional]** | Open `StorageAdapter` for the documented Sutrata Cloud sync API. Not bundled by default; the app works identically without it. | GPL-3.0-or-later |

`@sutrata/editor` is split out of today's `@sutrata/app`. The split is what lets
other products, including Sutrata Cloud, embed the editor without forking it.

### 11.2 Frontend

```
┌──────────────────────────────────────────────────────────────┐
│ @sutrata/app (shell)                                      │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ @sutrata/editor                                     │  │
│  │  Editor (ProseMirror) · Navigator · Synopsis · Inspector│  │
│  │        │ single source of truth: Sutra text          │  │
│  │  ┌─────▼──────────────────────────────────────────┐    │  │
│  │  │ @sutrata/parser (AST, serializer, romanize) │    │  │
│  │  └────────────────────────────────────────────────┘    │  │
│  │  Extension points (§11.5): storage · ai · speech ·     │  │
│  │  panels · commands · export · session · collab         │  │
│  └───────────▲───────────────────────────────▲────────────┘  │
│   Local storage adapter           BYO-key AI / speech adapter │
│   (IndexedDB / Tauri FS)          (direct to provider)        │
└──────────────────────────────────────────────────────────────┘
```

### 11.3 Export Pipeline

```
.sutra text ──► Sutra AST ──► paginator + page style ──► print HTML ──► PDF (platform print)
                    │
                    ├──► docx serializer ──► DOCX
                    ├──► report extractor ──► one-liner · shot list · cast report (PDF/DOCX/CSV/XLSX)
                    └──► Fountain serializer (lossy, with warnings)
```

### 11.4 Technology Stack

| Layer | Technology | Rationale |
|---|---|---|
| Editor core | **ProseMirror** | Proven complex-IME handling. |
| Format parser | **Custom TypeScript Sutra parser**, published with conformance corpus | The parser *is* the format's reference implementation. |
| Text shaping | **Browser/WebView-native** | Same engine for editing and PDF; correct Indic, Nastaliq, BiDi. |
| PDF | **Print pipeline** (own paginator + platform print-to-PDF) | Offline, no backend, correct shaping. |
| DOCX | **docx** npm | Supports `w:cs` / `w:eastAsia`. |
| Voice | Whisper API (BYO key) · Web Speech · whisper.cpp (desktop) | §6.2. |
| AI | Multi-provider client; alias model IDs from static CDN config | §7.1. |
| Desktop / mobile | Tauri v2 | Small binaries, native WebView. |
| CI/CD | GitHub Actions | Parser, app build, tofu gate, conformance, extension-API contract tests. |
| Testing | Vitest · Playwright (incl. IME scenarios) · conformance corpus | |

### 11.5 Extension Points **[P1 interface, stable by P2]**

`@sutrata/editor` exposes a typed, semver-versioned extension API. The standalone app
provides the default implementation of each. Embedders (Sutrata Cloud, third-party
plugins) provide their own. **No embedder may require forking the editor.**

| Extension point | Purpose | OSS default |
|---|---|---|
| `StorageAdapter` | open/save/list/autosave/versions of `.sutra` documents | IndexedDB (web), filesystem (desktop) |
| `AIProvider` | LLM completion with streaming; declares capabilities and data-policy text for disclosure | BYO-key multi-provider client |
| `SpeechProvider` | speech-to-text | BYO-key Whisper, Web Speech, whisper.cpp |
| `PanelRegistry` | add side panels, inspector sections, and app-bar items; receives the AST and scene IDs | Built-in panels |
| `CommandRegistry` | add commands, menu items, keyboard shortcuts | Built-in commands |
| `ExportRegistry` | add export formats and report types | PDF, DOCX, Fountain, reports |
| `SessionContext` | current user identity, permissions (read-only, comment, edit), feature flags | Single local user, full permissions |
| `CollabBinding` | hook to bind the editor state to an external real-time sync provider (e.g. a Yjs document) | None |
| `DecorationProvider` | render external annotations (comments, breakdown highlights, revision marks) anchored to scene IDs and text ranges | None |

Rules:

- The Sutra text remains the source of truth for every embedder. Extensions read the
  AST; they change the document only through editor transactions, never by mutating
  internal state.
- Extension API changes follow semver. Breaking changes need a major version and a
  migration note.
- CI includes an **extension contract test**: a stub embedder that implements every
  extension point must build and pass its tests against every commit.

### 11.6 Editor Serializer Fidelity **[P2]**

Two serialization paths exist (see AGENTS.md): the parser serializer is byte-faithful; the
ProseMirror → Sutra serializer regenerates text and is best-effort. Before any
real-time collaboration binding (§11.5 `CollabBinding`) is used in production, the editor
path must become **lossless for every element and attribute**: unknown attributes and
metadata carried as node attributes, and a property-based test that
`parse → PM → serialize → parse` yields an equal AST for the full conformance corpus.

### 11.7 Risk Register

| Risk | Mitigation |
|---|---|
| Print-pipeline PDF differs across browsers/WebViews | Own paginator controls breaks; golden-PDF visual tests per platform; documented supported browsers. |
| Romanization and legacy-font edge cases (nukta, chillu, ZWJ/ZWNJ, Tamil ṉ/ṟ/ḻ, schwa handling) | Per-script test corpus of native text with expected ISO 15919 output; legacy-font round-trip failures are release blockers. |
| ProseMirror ⇄ plain-text fidelity | Byte-round-trip test on every save path in CI; §11.6. |
| Local Whisper performance | Desktop-native only, P2; cloud path is the P1 guarantee. |
| AI output validity | Parser-gated insertion; invalid Sutra never reaches the document. |
| Free-tier model quality on Indic dictation | Per-language eval gating; premium BYO key as fallback. |
| Free-tier provider policy changes | Multi-provider client + static CDN config switches defaults without a release. |
| Mobile IME fragility | §10.7 per-keyboard gating. |
| Licensing mistakes | LICENSE files and CLA before the first outside contribution (§1.7). |

---

## 12. Appendix: Sutra Quick Reference

Normative reference: [sutra_format_spec.md](sutra_format_spec.md).

```markdown
---                          ← frontmatter: title page + defaults
title: आख़िरी ट्रेन
lang: hi
page: A4
---

# अंक एक                     ← section (act/sequence)

## INT. रेलवे स्टेशन - रात {#sc1}   ← scene heading + stable ID
& synopsis: मीरा और विक्रम सच जानते हैं। ← scene synopsis (reserved metadata key)
& number: 1                  ← locked production scene number
& actors: दीपिका, रणबीर       ← artists in scene
& status: draft
& shots:                     ← planned shot list
  - WIDE: खाली प्लेटफ़ॉर्म

प्लेटफ़ॉर्म खाली है।            ← action (plain paragraph)

@मीरा                        ← character cue
( धीरे से )                   ← parenthetical
हम ट्रेन छूट गए, है ना?        ← dialogue

@विक्रम ^                    ← dual dialogue (second cue)
सुनो तो—

>> SMASH CUT TO:             ← transition
>> मध्यांतर <<                ← centered text
~ चल छैयाँ छैयाँ              ← lyrics
[[ यहाँ बारिश जोड़ें ]]         ← production note (toggleable in export)
<!-- पुराना सीन -->           ← comment (never exported)
===                          ← forced page break

# पात्र {#characters}         ← character registry
@मीरा
& actor: दीपिका
& aliases: डॉ. मीरा शर्मा

*italic* **bold** _underline_ ← emphasis (any script)
\@ \= \&                     ← escapes for literal sigils
```

---

*End of Specification — Sutrata (Open Source) v3.0 Draft*
