# Sutra — A Plain-Text Screenplay Format for World Languages

**Version:** 1.0 Draft  
**File extension:** `.sutra`  
**MIME type:** `text/x-sutra`  
**Status:** For Review  
**License:** [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) — this specification (text and grammar) is free to implement, copy, and adapt, including by competing tools, provided attribution is given to the Sutra project. The reference parser (`@sutrata/parser`) is separately licensed Apache-2.0; see its own `LICENSE` file.  

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Design Principles](#2-design-principles)
3. [File Basics](#3-file-basics)
4. [Document Structure](#4-document-structure)
5. [Frontmatter (Title Page & Defaults)](#5-frontmatter-title-page--defaults)
6. [Element Syntax](#6-element-syntax)
7. [Scene Metadata](#7-scene-metadata)
8. [Reserved Sections: Synopsis & Characters](#8-reserved-sections-synopsis--characters)
9. [Language & Script](#9-language--script)
10. [Attributes](#10-attributes)
11. [Parsing Rules](#11-parsing-rules)
12. [Rendering Guidance](#12-rendering-guidance)
13. [Fountain Migration](#13-fountain-migration)
14. [Conformance](#14-conformance)
15. [Complete Annotated Example](#15-complete-annotated-example)

---

## 1. Introduction

Sutra is a plain-text screenplay format built on Markdown. It exists because
Fountain — the de-facto plain-text screenplay standard — detects screenplay
elements from Latin-script conventions: character cues are recognized by ALL
CAPS, scene headings by the prefixes `INT.`/`EXT.`. These conventions do not
exist in Tamil, Devanagari, Telugu, Arabic, or most of the world's scripts,
which makes Fountain structurally unable to serve writers in those languages
without falling back to "forced" syntax for every single element.

Sutra inverts the design: **element type is always determined by explicit,
language-neutral structure — never by casing, never by English keywords.**
Industry conventions (`INT.`, `EXT.`, `CUT TO:`, ALL-CAPS names) remain welcome
as *content* and are recognized where helpful, but no parsing decision ever
depends on them.

Beyond the script itself, Sutra captures the working documents that
surround a screenplay in Indian (and global) film workflows: the **scene
synopsis** (per-scene one-sentence summary — *not* the logline), the story
**synopsis**, the
**actors** attached to each scene, the planned **shot list**, and extensible
per-scene workflow data — all in the same human-editable text file.

### Terminology note

This document uses **"scene synopsis"** for the one-sentence summary of a
single scene. In the industries this format targets, the same thing is
commonly called a **"one-liner"** (as in scene breakdowns and one-liner
schedules); we use "scene synopsis" throughout to avoid confusion with the
**logline**, the single sentence describing the entire film.

The key words MUST, MUST NOT, SHOULD, and MAY are to be interpreted as
described in RFC 2119.

---

## 2. Design Principles

1. **Language-neutral structure.** Every element is identified by a sigil or
   Markdown construct that types identically in any Unicode script. A Tamil
   screenplay and an English screenplay use the exact same markup.
2. **Markdown as the base.** A `.sutra` file opened in any generic Markdown
   viewer (GitHub, Obsidian, VS Code preview) renders as a readable, sensibly
   structured document. Sutra adds meaning; it does not break Markdown.
3. **Plain-text first.** Everything — script, scene synopses, shot lists, workflow
   status — is editable in any text editor, diffable, and version-controllable.
4. **Convention-friendly.** `INT./EXT.`, transitions, and ALL-CAPS names are
   widely used in Indian industries too. Sutra preserves them as content
   and lets tools recognize them, but provides language-neutral metadata
   channels (`& setting:`, `& time:`) that carry the same information when the
   heading is written in a non-Latin script.
5. **One file, whole workflow.** Scene metadata travels *with* the scene, so
   reordering scenes never detaches their scene synopses, actors, or shots.
6. **Forward-compatible.** Unknown metadata keys and unknown attributes MUST
   be preserved by conforming tools on read–write round trips.

---

## 3. File Basics

| Property | Requirement |
|---|---|
| Encoding | UTF-8, without BOM preferred; parsers MUST accept a BOM |
| Normalization | Writers SHOULD store NFC; parsers MUST compare strings NFC-normalized |
| Line endings | LF preferred; parsers MUST accept CRLF |
| Extension | `.sutra` |
| Bidirectional text | Logical order per the Unicode Bidirectional Algorithm; no visual-order storage |

A Sutra document is a sequence of **blocks** separated by blank lines
(see §11). All sigils are evaluated at the start of a line only.

---

## 4. Document Structure

```
┌──────────────────────────────┐
│ YAML frontmatter (optional)  │  title page + document defaults
├──────────────────────────────┤
│ # Section headings           │  acts / sequences / episodes
│   ## Scene headings          │  one per scene
│     & synopsis: ...          │  scene synopsis (a reserved metadata key)
│     & key: value             │  other scene metadata (actors, shots, status…)
│     script blocks            │  action, cues, dialogue, transitions…
├──────────────────────────────┤
│ # Reserved sections          │  {#synopsis}, {#characters}
└──────────────────────────────┘
```

- `#` (level-1 heading) — **structural section**: act, sequence, episode, or a
  reserved section (§8). Purely organizational; never printed in script pages
  unless the tool is asked to.
- `##` (level-2 heading) — **scene heading**, always. Every scene begins with
  one.
- `###` and deeper — sub-structure for outlining *inside* sections (e.g.
  beats under an act, headings inside the Synopsis section). They are never
  scene headings.

Sections and reserved sections may appear in any order; the conventional
layout is frontmatter → synopsis → script → characters, but tools MUST NOT
require it.

---

## 5. Frontmatter (Title Page & Defaults)

An optional YAML block delimited by `---` lines at the very top of the file.

```yaml
---
format: sutra/1.0
title:
  hi: आख़िरी ट्रेन
  en: The Last Train
author: रंगी पराता
credit: लेखक
draft: First Draft
date: 2026-06-11
contact: |
  rangi@example.com
  +91 98xxx xxxxx
logline: दो अजनबी आख़िरी ट्रेन छूट जाने पर एक रात साथ बिताने को मजबूर होते हैं।
lang: hi
lang-secondary: [en]
page: A4                  # A4 | Letter
copyright: © 2026 Rangi Parata
---
```

### Reserved frontmatter keys

| Key | Type | Meaning |
|---|---|---|
| `format` | string | Format identity and version, `sutra/1.0`. SHOULD be present. |
| `title` | string *or* map | Title; a map allows one entry per language (BCP-47 keys). |
| `author`, `credit`, `source`, `contact`, `copyright`, `draft`, `date`, `revision` | string | Standard title-page fields. |
| `logline` | string | The one-sentence premise of the whole film. |
| `lang` | string | Primary language, BCP-47 (`hi`, `ta`, `te`, `en-IN`, …). Default `und`. |
| `lang-secondary` | list | Additional languages tools should expect (spellcheck, fonts). |
| `page` | string | Target page size for export: `A4` (default) or `Letter`. |
| `revision-set` | string | Active production revision color (§10.1), e.g. `blue`. Absent = no revision is active. |
| `revision-colors` | list | Revision color sequence (§10.1). Default: `white, blue, pink, yellow, green, goldenrod, buff, salmon, cherry, double-blue, double-pink, double-yellow, double-green`. |
| `locked-pages` | list | Locked page breaks (§10.2). Absent = pages are not locked. |

Custom keys are permitted and MUST be preserved on round-trip. When `title` is
a map, tools SHOULD display the entry matching `lang` and MAY print others as
subtitle lines.

A file without frontmatter is valid; all defaults apply (`lang: und`,
`page: A4`).

---

## 6. Element Syntax

All examples below show Hindi and English interchangeably — the markup is
identical in both.

### 6.1 Scene Heading

A level-2 Markdown heading. The heading text is free-form.

```markdown
## INT. रेलवे स्टेशन - रात {#sc12}
```

- An optional **attribute block** `{...}` at the end of the line (§10) can
  carry a stable scene ID (`#sc12`), language override, or other attributes.
- Tools MAY additionally parse the conventional `SETTING. LOCATION - TIME`
  shape when present (in any language, via locale keyword tables), but the
  normative, language-neutral channel for this data is the scene metadata
  keys `& setting:`, `& location:`, `& time:` (§7). When both are present,
  the metadata keys win.
- The **scene ID** (`{#sc12}`, `{#12}`) is the stable anchor for
  cross-references, comments, scene-level diff and page locking. IDs MUST be
  unique within the document. Writers are not required to assign IDs; tools
  SHOULD offer to generate them and MUST NOT change existing ones.
- The **scene number** (shown in the navigator, on the slate, in breakdown
  sheets) is the `& number:` metadata key when present (§7.4); otherwise
  tools MAY display the scene ID as the number. Keeping the two separate
  lets a scene be renumbered for production without breaking anything
  anchored to its ID.

### 6.2 Action

Any plain paragraph that is not claimed by another rule. No sigil.

```markdown
प्लेटफ़ॉर्म खाली है। घड़ी 11:58 दिखाती है।
```

Consecutive lines without an intervening blank line belong to the same action
block. Standard Markdown emphasis applies (§6.10).

### 6.3 Character Cue

A line beginning with `@`. Everything after `@` up to the optional attribute
block is the cue.

```markdown
@मीरा
@VIKRAM (V.O.)
@मीरा (फ़ोन पर)
```

- A parenthesized **cue extension** — `(V.O.)`, `(O.S.)`, `(CONT'D)`, or any
  localized equivalent — is part of the cue line and preserved verbatim.
- The cue name (text before any parenthesis, trimmed, NFC-normalized) is the
  **character key** used for character indexing. Matching is exact string
  matching — never case folding — so it behaves identically in caseless
  scripts. Alias resolution happens through the character registry (§8.2).
- ALL CAPS is *permitted and customary* for Latin-script names but carries no
  meaning to the parser.

### 6.4 Dialogue

Every line following a character cue, until the first blank line, is dialogue
spoken by that character.

```markdown
@मीरा
( धीरे से )
हम ट्रेन छूट गए, है ना?
```

### 6.5 Parenthetical

A line *inside a dialogue block* consisting entirely of text wrapped in
parentheses — ASCII `( )` or fullwidth `（ ）`.

### 6.6 Dual Dialogue

Append `^` to the *second* character cue. The two adjacent dialogue blocks
render side by side.

```markdown
@मीरा
नहीं—

@विक्रम ^
सुनो तो—
```

### 6.7 Transition and Centered Text

A line beginning with `>>`:

- `>> text` — **transition** (right-aligned on the page).
- `>> text <<` — **centered text**.

```markdown
>> CUT TO:

>> मध्यांतर <<
```

The double chevron is deliberate: a single `>` is Markdown's blockquote, which
Sutra leaves untouched (usable for quoted documents inside the synopsis,
letters read aloud, etc.).

### 6.8 Lyrics

Lines prefixed with `~` are lyrics (one `~` per line).

```markdown
~ चल छैयाँ छैयाँ छैयाँ छैयाँ
~ चल छैयाँ छैयाँ छैयाँ छैयाँ
```

### 6.9 Notes, Comments, and Page Breaks

| Construct | Syntax | Behavior |
|---|---|---|
| Production note | `[[ जब बजट मिले तो यहाँ बारिश जोड़ें ]]` | Visible in editors, toggleable in exports. Inline or whole-line. |
| Comment / omitted text | `<!-- old version of the scene -->` | Never exported. Standard HTML/Markdown comment; may span lines. |
| Page break | `===` alone on a line (3+ equals) | Forced page break. |

### 6.10 Emphasis

Standard Markdown inline emphasis, valid inside any text-bearing element and
in any script:

`*italic*` · `**bold**` · `***bold italic***` · `_underline_`

(Sutra assigns `_underline_` the screenplay meaning *underline*, not
italic, matching Fountain and screenwriting practice.)

### 6.11 Inline Shots

A camera direction written into the script body (`CLOSE ON: मीरा का हाथ`) is
simply an **action** paragraph — no special syntax. The *planned* shot list
for production lives in scene metadata (`& shots:`, §7.2), keeping creative
text and production planning separate but adjacent.

---

## 7. Scene Metadata

Metadata lines appear **immediately after the scene heading**, before the
first script block. A single sigil:

### 7.1 Key–Value Metadata: `&`

A line of the form `& key: value`. Keys are ASCII kebab-case identifiers
(values are any Unicode text). A key with an empty value opens a **list**: the
following indented `- ` lines are its items.

```markdown
## INT. रेलवे स्टेशन - रात {#sc12}
& synopsis: मीरा और विक्रम आख़िरी ट्रेन छूट जाने का सच जानते हैं।
& setting: INT
& location: रेलवे स्टेशन, चारबाग़
& time: रात
& story-day: 3
& actors: दीपिका, रणबीर
& status: draft
& tags: climax-setup, two-hander
& est-duration: 2m30s
& shots:
  - WIDE: खाली प्लेटफ़ॉर्म, घड़ी 11:58 पर
  - CU: मीरा का चेहरा — एहसास
  - OTS विक्रम: टिकटें कूड़ेदान में गिरती हुई
```

### Reserved scene keys

| Key | Value | Meaning |
|---|---|---|
| `synopsis` | text | The scene's one-liner (industry term: "one-liner" or "breakdown line"). The collection of all synopses across a script *is* the scene-by-scene breakdown — tools can derive beat boards and breakdown exports directly from these lines. Rendered distinctly (italic) in editors and the scene navigator. |
| `setting` | `INT` \| `EXT` \| `INT/EXT` | Language-neutral interior/exterior flag; overrides anything inferred from the heading text. |
| `location` | text | Canonical location name (drives location reports; may differ from the heading's display text). |
| `time` | text | Time of day (`दिन`, `रात`, `DAWN`, …). |
| `story-day` | text | Story-chronology day, for continuity (`3`, `3-रात`). |
| `actors` | comma list | Artists appearing in the scene (people, not characters). Drives shot lists, scheduling, and call sheets. |
| `characters` | comma list | Characters in the scene. Normally derived from `@` cues; declare explicitly to add non-speaking characters. |
| `status` | text | Workflow state (`draft`, `revised`, `locked`, `omitted` — open vocabulary). |
| `tags` | comma list | Free-form labels for filtering and color-coding. |
| `est-duration` | text | Writer's estimate of screen time (`2m30s`). The language-neutral replacement for the 1-page≈1-minute rule, which does not transfer to non-Latin scripts. |
| `shots` | list | Planned shot list (§7.3). |
| `lang` | BCP-47 | Language override for this scene (§9). |
| `number` | text | Locked production scene number (§7.4): `12`, `12A`. |

**Unknown keys are valid** and MUST be preserved on round-trip. This is the
extension point for downstream workflow data — `& props:`, `& vfx:`,
`& budget-code:`, `& permit-status:` — without any format change.

### 7.3 Shot List Items

Each `- ` item under `& shots:` is free text, with one recognized convention:
an optional leading `TYPE:` token (`WIDE`, `CU`, `MCU`, `OTS`, `POV`, `INSERT`,
`AERIAL`, or any production-house term) that tools MAY use to group and label
shots. Everything after the colon is the shot description. Items may reference
actors or scene IDs in prose; no further structure is imposed in 1.0.

### 7.4 Scene Numbers and Omitted Scenes

`& number:` records a scene's production number. "Locking scene numbers"
writes `& number:` to every scene from its current position; after that:

- Locked numbers never change. A scene inserted between `12` and `13` is
  numbered `12A` (then `12B`, …); one inserted before scene `1` is `A1`.
- A scene removed from the script is kept as an **omitted scene**: its
  heading and `& number:` stay, `& status: omitted` is set, and its body is
  empty (or kept in a comment). Renderers print the heading line as
  `OMITTED` next to the number; numbering of later scenes is unaffected.

---

## 8. Reserved Sections: Synopsis & Characters

Reserved sections are level-1 sections recognized by **attribute ID**, not by
their heading text — so they can be titled in any language:

```markdown
# कथा-सार {#synopsis}
# पात्र {#characters}
```

As a convenience, the English headings `# Synopsis` and `# Characters`
*without* an ID are recognized as aliases.

### 8.1 Synopsis Section (`{#synopsis}`)

Free Markdown prose: the short synopsis, full synopsis, or treatment.
Sub-headings (`###` and deeper) may structure it by act. Tools display this in
a reading view and include or exclude it from exports on request. The
*per-scene* synopsis is the `& synopsis:` scene metadata key (§7.1), not this section.

### 8.2 Characters Section (`{#characters}`)

A registry of characters, each introduced by a `@` cue line followed by `&`
metadata — the same sigils as in scenes, reused:

```markdown
# पात्र {#characters}

@मीरा
& actor: दीपिका
& aliases: डॉ. मीरा शर्मा
& description: 34, सर्जन। ज़रूरत से ज़्यादा सोचती है।

@विक्रम
& actor: रणबीर
& description: 36, रेलवे क्लर्क।
```

Reserved character keys: `actor` (the cast member, linking the character to
`& actors:` scene lines), `aliases` (comma list — other cue names that
resolve to this character, solving the "JOHN" / "DETECTIVE SHARMA" identity
problem at the format level), `description`, `lang`. Unknown keys preserved.

The section is optional; characters used in cues but absent from the registry
are still valid.

**Parsing note:** inside a `{#characters}` section, lines beginning with `&`
that follow a `@` cue are metadata, not dialogue — the section context
overrides the normal dialogue rule (§11.1, rule 7). Script elements other
than `@` and `&` are not valid inside this section.

---

## 9. Language & Script

### 9.1 Language Identification

- Language tags are **BCP-47** (`hi`, `ta`, `te`, `bn`, `ur`, `en-IN`, …).
- The document default is frontmatter `lang:`; `lang-secondary:` lists other
  languages tools should be prepared for.
- Override scope, narrowest wins:
  1. element — `{lang=en}` attribute on a scene heading, cue, or block (§10);
  2. scene — `& lang:` metadata;
  3. document — frontmatter `lang:`.
- Where no tag applies, tools SHOULD auto-detect writing script per block
  from Unicode ranges and combine it with the document language to pick
  fonts, line-breaking rules, and spellcheck dictionaries. Tags exist for
  the case auto-detection cannot solve: languages sharing a script
  (Hindi/Marathi, Bengali/Assamese).

### 9.2 Native-Script Storage

Text is stored in the script it was written in. Indic-script text is stored as
native Unicode in that script (Devanagari for Hindi, Tamil script for Tamil, and
so on). Sutra has no romanized storage form: there is no marker that declares
Latin text to be romanized Indic. Text written in Latin script, in any language
(including informally romanized Hindi), is Latin text, and tools MUST NOT convert
between scripts when reading or writing a file.

How writers enter native text (OS keyboards, phonetic IMEs, voice) and how
tools present it to readers (including romanized copies for export) are tool
features outside this format. They never change the stored text.

### 9.3 Mixed-Script Content

A file may freely mix scripts (Hindi headings, English transitions, Tamil
dialogue). Code-switching *within* a dialogue block needs no markup — it is
preserved verbatim, and rendering falls back per Unicode run. Tags are only
needed where a whole element's language matters to tooling.

---

## 10. Attributes

An attribute block is `{ ... }` at the **end of the first line** of a scene
heading, section heading, or character cue. Pandoc-style contents:

| Form | Meaning | Example |
|---|---|---|
| `#word` | Stable ID | `{#sc12}`, `{#synopsis}` |
| `key=value` | Property | `{lang=en}`, `{lang=mr}` |
| `rev=color` | Revision mark (§10.1) | `{rev=blue}` |

Multiple entries are space-separated: `{#sc12 lang=en}`. Unknown attributes
MUST be preserved. Values containing spaces use quotes: `{key="some value"}`.

For an **action paragraph**, an attribute block at the end of its first line
applies to the whole paragraph (rarely needed; auto-detection covers most
cases). The same holds for transition, centered-text and lyrics blocks.

### 10.1 Revision Marks

Production revisions follow the standard color sequence, recorded in
frontmatter:

```yaml
revision-set: blue          # the revision currently being written
revision-colors: [white, blue, pink, yellow, green, goldenrod, buff, salmon, cherry]
```

`revision-colors` is optional; the default sequence is listed in §5. Colors
are lowercase kebab-case names (`double-blue`). `white` is the unrevised
first draft and is never written as a mark.

A block changed during a revision carries `rev=<color>` in the attribute
block on its first line:

```markdown
## INT. रेलवे स्टेशन - रात {#12 rev=blue}

मीरा घड़ी देखती है। {rev=pink}

@मीरा {rev=blue}
तुम फिर देर से आए।
```

- The mark covers the whole block: a heading marks only the heading line
  (not the scene); a cue marks the cue and its dialogue.
- A block keeps the color of the **latest** revision that changed it.
  Tools MUST NOT remove marks when a new revision starts; "clear revision
  marks" is an explicit user action (typically when a new draft begins).
- Renderers print a revision asterisk (`*`) in the right margin beside
  marked lines, and MAY tint marked blocks with the color.
- Readers that don't know revisions preserve `rev=` like any unknown
  attribute (§10) and render the text normally.

### 10.2 Page Locking

`locked-pages` records where each page began when pages were locked, so
exports keep page numbers stable across later edits. It is a flow list of
page-start anchors, one per page, in order:

```yaml
locked-pages: [1:0, 1:6, 2:0, 2:3+214, 3:0]
```

Each anchor is `<scene-id>:<block>[+<chars>]`: the scene's `{#id}`, the
0-based index of the block within the scene (`0` is the heading, then its
script blocks in order, excluding `&` metadata), and optionally the number of
characters into that block's text where the page began. Page *n* begins at
the *n*th anchor.

- Locking requires every scene to have an ID; tools MUST refuse to lock (and
  SHOULD point out the scenes that lack one) otherwise.
- After locking, text that no longer fits on its locked page flows onto
  **A-pages** (`12A`, `12B`, …) rather than renumbering later pages. A page
  whose content was entirely removed prints as `12-13` (combined) or keeps
  its number with "OMITTED" content — the renderer's choice.
- Anchors whose scene no longer exists are ignored.

---

## 11. Parsing Rules

### 11.1 Block Model

1. Split the document into frontmatter (if the first line is `---`) and body.
2. Split the body into blocks at blank lines (a line containing only
   whitespace is blank).
3. Classify each block by its first line, checking in this order
   (first match wins):

| Order | First line starts with | Block type |
|---|---|---|
| 1 | `<!--` | Comment (may consume following blocks until `-->`) |
| 2 | `===` (3+ `=`, nothing else) | Page break |
| 3 | `## ` | Scene heading |
| 4 | `# ` | Section heading (level 1; `###`+ = deeper section) |
| 5 | `& ` | Metadata (only valid in scene-metadata or character-registry position; elsewhere action) |
| 7 | `@` | Character cue → dialogue block |
| 8 | `>> ` | Transition, or centered text if the line also ends with `<<` |
| 9 | `~` | Lyrics |
| 10 | `> ` | Markdown blockquote (passed through) |
| 11 | `[[` (whole block) | Standalone production note |
| 12 | *anything else* | Action |

4. Within a dialogue block (rule 7): line 1 is the cue; each subsequent line
   is a parenthetical if fully parenthesized, else dialogue.

*Scene-metadata position* means: the blocks between a scene heading and the
first block that is not `&` metadata. Metadata lines may be grouped in one
block or separated by blank lines, but all must precede the script body.

### 11.2 Escaping

A backslash before a sigil at the start of a line yields literal text:
`\@`, `\&`, `\~`, `\>>`, `\#`, `\===`, `\[[`. Inside text, `\*`, `\_`,
`\[`, `\{` escape the Markdown/attribute specials. A parser encountering an
escape MUST emit the literal character(s) and treat the line as action.

### 11.3 Error Handling

Sutra has no fatal parse errors: every line of text is *some* element
(worst case, action). Tools SHOULD warn on: duplicate scene IDs, metadata
lines appearing after the script body has begun, unknown `format:` major
versions.

---

## 12. Rendering Guidance

### 12.1 In Generic Markdown Viewers (graceful degradation)

A `.sutra` file viewed on GitHub/Obsidian/etc. without Sutra support shows:
frontmatter as a metadata table (on GitHub) or fence; sections and scene
headings as H1/H2 — giving a navigable outline of acts and scenes;
`=`/`&`/`@`/`>>`/`~` lines as ordinary paragraphs (readable, just unstyled);
comments hidden; notes visible in brackets. Nothing renders as broken markup.
This degradation behavior is a design requirement: future syntax additions
MUST NOT produce constructs that render as garbage in CommonMark.

### 12.2 In Sutra-Aware Tools

Screenplay page layout (margins, cue indentation, dual-dialogue columns,
`(MORE)`/`(CONT'D)` page-break behavior, A4 vs Letter) is the responsibility
of the rendering tool and is **out of scope for this format spec** — by
design, since fixed character-grid layout rules do not transfer across
scripts. The format guarantees the *data* (element types, languages, page
size preference); the application spec defines the *presentation*.

Recommended editor behaviors: fold/unfold `&` metadata; show scene synopses as
a scene-list panel (the one-liner schedule view); use `& actors:` ∪ `& shots:`
to generate shot-list and call-sheet exports; treat `& status: omitted` as a
struck-through scene that keeps its `& number:` (§7.4).

---

## 13. Fountain Migration

Conforming tools SHOULD import `.fountain`. Mapping:

| Fountain | Sutra |
|---|---|
| Title page key-values | YAML frontmatter |
| Scene heading (detected or `.forced`) | `## heading` |
| Action (plain or `!forced`) | Action paragraph |
| `CHARACTER` / `@forced character` | `@CHARACTER` |
| Dialogue, parentheticals | Same shape, under the cue |
| `CHARACTER ^` (dual dialogue) | `@CHARACTER ^` |
| `> TRANSITION:` / detected `CUT TO:` | `>> TRANSITION:` |
| `> centered <` | `>> centered <<` |
| `~lyric` | `~ lyric` |
| `= synopsis` | `& synopsis: ...` metadata key under the nearest scene heading |
| `[[note]]` | `[[note]]` (unchanged) |
| `/* boneyard */` | `<!-- comment -->` |
| `===` page break | `===` (unchanged) |
| `# Section` headings | `#` sections (Fountain `##`/`###` sections shift to `###`+, since Sutra reserves `##` for scenes) |
| Emphasis | Unchanged |

Import is lossless for well-formed Fountain. Export *to* Fountain is lossy
(scene synopses survive as `=` synopses; `&` metadata, attributes, language tags,
and the character registry have no Fountain equivalent and SHOULD be emitted
as `[[notes]]` or dropped with a warning).

---

## 14. Conformance

A **Sutra 1.0 parser** MUST implement: §3 file basics, §4 structure,
§5 frontmatter, §6 element syntax, §7 metadata (including preservation of
unknown keys), §8 reserved-section recognition, §10 attributes, §11 parsing
rules.

A **Sutra 1.0 editor/converter** MUST additionally round-trip files
byte-faithfully where unedited (whitespace style of untouched blocks
preserved).

Version negotiation: `format: sutra/1.0`. Tools encountering a higher
minor version (`1.x`) MUST parse what they understand and preserve the rest;
a higher major version MAY be rejected.

---

## 15. Complete Annotated Example

```markdown
---
format: sutra/1.0
title:
  hi: आख़िरी ट्रेन
  en: The Last Train
author: रंगी पराता
draft: Second Draft
date: 2026-06-11
logline: दो अजनबी आख़िरी ट्रेन छूट जाने पर एक रात साथ बिताने को मजबूर होते हैं।
lang: hi
lang-secondary: [en]
page: A4
---

# कथा-सार {#synopsis}

मीरा, एक सर्जन, और विक्रम, एक रेलवे क्लर्क, लखनऊ के चारबाग़ स्टेशन पर
आख़िरी ट्रेन छूटने के बाद मिलते हैं…

# अंक एक

## INT. रेलवे स्टेशन, चारबाग़ - रात {#1}
& synopsis: मीरा और विक्रम आख़िरी ट्रेन छूट जाने का सच जानते हैं।
& setting: INT
& time: रात
& story-day: 1
& actors: दीपिका, रणबीर
& status: revised
& shots:
  - WIDE: खाली प्लेटफ़ॉर्म, घड़ी 11:58 पर
  - CU: मीरा का चेहरा — एहसास
  - OTS विक्रम: टिकटें कूड़ेदान में गिरती हुई

प्लेटफ़ॉर्म खाली है। घड़ी **11:58** दिखाती है।

@मीरा
( धीरे से )
हम ट्रेन छूट गए, है ना?

@विक्रम
There's no next train. [[दर्शक को यहीं पता चलना चाहिए]]

वह दोनों टिकटें कूड़ेदान में गिरा देता है।

>> SMASH CUT TO:

## EXT. हाईवे - भोर {#2}
& synopsis: दोनों लिफ़्ट के इंतज़ार में हैं; पहली बार खुलकर बात होती है।
& actors: दीपिका, रणबीर
& status: draft

<!-- पुराना संस्करण: यहाँ ऑटो-रिक्शा वाला सीन था -->

@मीरा (V.O.)
मुझे तभी समझ जाना चाहिए था।

~ चल छैयाँ छैयाँ छैयाँ छैयाँ

>> मध्यांतर <<

# पात्र {#characters}

@मीरा
& actor: दीपिका
& aliases: डॉ. मीरा शर्मा
& description: 34, सर्जन। ज़रूरत से ज़्यादा सोचती है।

@विक्रम
& actor: रणबीर
& description: 36, रेलवे क्लर्क।
```

Every construct above — scene IDs, scene synopses, actor lines, shot lists,
bilingual dialogue, the character registry — survives a plain-text edit in
any editor and renders as a readable outline on any Markdown host.

---

*End of Specification — Sutra 1.0 Draft*
