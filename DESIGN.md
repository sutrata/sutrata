---
name: Sutrata
description: A quiet, warm-paper screenplay workspace under a dark amber-lit app bar, with the page as the only loud thing.
colors:
  obsidian: "#141413"
  obsidian-bar: "#191917"
  tungsten: "#c4760a"
  tungsten-hover: "#a35f04"
  tungsten-badge: "#d97706"
  amber-glow: "#fbbf24"
  amber-wash: "#fef3c7"
  amber-edge: "#fcd34d"
  deep-amber: "#92400e"
  filmstrip-brown: "#502308"
  toolbar-paper: "#f3f1e9"
  panel-cream: "#fcfbfa"
  panel-muted: "#f4f2ea"
  page-white: "#ffffff"
  rule-light: "#e2e0d6"
  rule-light-subtle: "#eeece4"
  ink: "#1c1b18"
  ink-secondary: "#59574f"
  ink-muted: "#8c897f"
  bar-text: "#f5f4ee"
  bar-text-secondary: "#a8a69d"
  bar-text-muted: "#737168"
  note-wash: "#fffbeb"
  classic-scene-teal: "#0a5c6a"
  classic-cue-rust: "#9c4221"
typography:
  chrome-label:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "12px"
    fontWeight: 500
  chrome-micro:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "9px"
    fontWeight: 600
    letterSpacing: "0.4px"
  chrome-brand:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    letterSpacing: "1.2px"
  dialog-title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "15px"
    fontWeight: 600
  script-body:
    fontFamily: "'Noto Sans', sans-serif"
    fontSize: "12pt"
    fontWeight: 400
  script-cue:
    fontFamily: "'Noto Sans', sans-serif"
    fontSize: "13pt"
    fontWeight: 700
  script-courier:
    fontFamily: "'Courier Prime', Courier, monospace"
    fontSize: "12pt"
    fontWeight: 400
rounded:
  xs: "2px"
  sm: "4px"
  md: "6px"
  lg: "8px"
  pill: "14px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  page-gutter: "40px"
components:
  appbar-button:
    backgroundColor: "transparent"
    textColor: "{colors.bar-text}"
    rounded: "{rounded.sm}"
    height: "28px"
    padding: "0 4px"
  appbar-button-primary:
    backgroundColor: "{colors.tungsten}"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
    height: "28px"
    padding: "0 10px"
  appbar-button-primary-hover:
    backgroundColor: "{colors.tungsten-hover}"
  toolbar-button:
    backgroundColor: "transparent"
    textColor: "#3d3d38"
    rounded: "{rounded.sm}"
    size: "32px"
    height: "28px"
  toolbar-button-active:
    backgroundColor: "#1a1a18"
    textColor: "#ffffff"
  file-pill:
    backgroundColor: "rgba(255,255,255,0.06)"
    textColor: "{colors.bar-text}"
    rounded: "{rounded.pill}"
    padding: "3px 10px"
  dialog:
    backgroundColor: "#ffffff"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    width: "480px"
  nav-status-chip:
    backgroundColor: "#e8e8e5"
    textColor: "#666666"
    rounded: "{rounded.xs}"
    padding: "1px 4px"
  synopsis-input:
    backgroundColor: "#ffffff"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "2px 4px"
  note-block:
    backgroundColor: "{colors.note-wash}"
    textColor: "{colors.ink}"
---

# Design System: Sutrata

## Overview

**Creative North Star: "The Lamplit Desk"**

Sutrata is an Operate-mode tool: the screenplay page is the workspace and everything else recedes. The frame is a dark obsidian app bar, like a screening room with the lights down. Under it sits a warm-paper toolbar and cream side panels, and in the middle is a white page column. A single tungsten amber accent, the color of a desk lamp, marks what is active, primary, or dirty. Anything not glowing amber is quiet.

The system is **light-canvas with a dark top rail**, not a dark theme. There is no theme switch and no `prefers-color-scheme` handling in the shipped CSS. Dark exists only in the app bar and in tooltips and a few dialog headers. Density is high and deliberate: 11–13px chrome, 28–34px controls, hairline borders, almost no shadow. Colour on the page itself (teal headings, rust character cues) belongs to the selected screenplay style, not to the UI.

The mark is the S-shaped filmstrip monogram in deep amber, amber glow and filmstrip brown, with the wordmark in uppercase tungsten at 11px and 1.2px tracking. The old clapper-folio "C" mark is retired.

**Key Characteristics:**
- Dark obsidian rail on top, warm cream and paper surfaces below. Nothing is pure grey; every neutral leans warm.
- One accent (tungsten amber). Its rarity is what makes it work.
- Flat by default. Hairline borders divide, and shadows appear only on floating things (tooltips, dialogs, menus, overflow).
- Every screenplay element's look is driven by `--cs-<element>-*` variables from the active style. The UI never hardcodes script formatting.
- Indic scripts are first-class: per-script font stacks and zero tofu.

## Colors

Warm neutrals with a single amber voice. The palette is defined as `--cs-ui-*` custom properties on `:root` in `packages/editor/src/styles/screenplay.css`, and components consume them with a hex fallback.

### Primary
- **Tungsten** (`#c4760a`, `--cs-ui-accent`): primary buttons, focus borders on inputs, active counters, links in panels. Darkens to **Tungsten Pressed** (`#a35f04`) on hover.
- **Tungsten Badge** (`#d97706`, `--cs-ui-accent-badge`): wordmark, dirty-state dot and indicator, note borders. This is the brighter lamp tone, used for small glyphs on dark or light grounds.
- **Deep Amber** (`#92400e`, `--cs-ui-accent-active`): selected text on amber wash, pressed states, the monogram body.
- **Amber Wash** (`#fef3c7`) with **Amber Edge** (`#fcd34d`): the selected and active tint for list items, chips and rows. Amber Glow (`#fbbf24`) appears only in the logo.

### Neutral
- **Obsidian** (`#141413`) and **Obsidian Bar** (`#191917`): the app frame and the top app bar.
- **Toolbar Paper** (`#f3f1e9`): the element toolbar under the app bar.
- **Panel Cream** (`#fcfbfa`) and **Panel Muted** (`#f4f2ea`): the navigator, the status bar, dialogs and side panels. Muted is for wells and hover rows.
- **Page White** (`#ffffff`): the editor page and cards.
- **Rule Light** (`#e2e0d6`) and **Rule Subtle** (`#eeece4`): every divider and input border on light. On dark, use white at 16% or 8%.
- **Ink** (`#1c1b18`), **Ink Secondary** (`#59574f`), **Ink Muted** (`#8c897f`): text on light. On the app bar use `#f5f4ee`, `#a8a69d` and `#737168`.
- **Note Wash** (`#fffbeb`): background of block notes, always paired with a 2px tungsten left edge.

### Style-owned colors
The default **Classic** style gives scene headings teal (`#0a5c6a`) and character cues rust (`#9c4221`). The **Traditional** style is serif and monochrome. These belong to the screenplay style, not the UI system. Never reuse them as chrome colors.

### Named Rules
**The One Lamp Rule.** Tungsten amber is the only saturated hue in the UI chrome. If a second accent seems necessary, the hierarchy is wrong.

**The Warm Neutral Rule.** No cool greys and no pure black chrome. Even the darkest surface is `#141413`, and tooltips are `#1a1a18`.

**The Status Exception.** Scene status chips (done, wip, todo) use small green, amber and rose tints. They are semantic and may not be reused for decoration.

## Typography

**Chrome:** the system sans stack, `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`. Chrome inherits the native platform feel and never loads a web font.
**Screenplay:** whichever font the active style names. The default Classic and Traditional styles use **Noto Sans** and **Noto Serif**. **Industry Courier** uses **Courier Prime**. All are bundled, with per-script Noto subsets for Indic languages.
**Mono:** `ui-monospace`, or `monospace` for filenames and sigils.

**Character:** chrome type is small, plain and unopinionated, built to disappear. The page carries all the typographic personality, and it is user-switchable.

### Hierarchy
- **Dialog title** (600, 15px): dialog headers.
- **Body / control** (400–500, 12–13px): the bulk of the chrome, including list rows, inputs and menu items. 12px is the most common size.
- **Micro** (11px): navigator metadata, synopsis fields, status-bar text.
- **Badge** (600, 9–10px, uppercase, 0.4px tracking): scene status chips and count pills.
- **Brand** (700, 11px, uppercase, 1.2px tracking, tungsten): wordmark only.
- **Screenplay elements** (11–14pt depending on element and style): scene heading and character 13pt bold, action and dialogue 12pt, section 14pt bold, notes 10pt. These come from `--cs-<element>-font-size` and its siblings.

### Indic script handling
`.cs-lang-<code>` classes put the style's `--cs-lang-<code>-font-family` first, then the body font, then the matching Noto script family (Devanagari, Tamil, Telugu, Kannada, Malayalam, Bengali, Gujarati, Gurmukhi, Oriya), then `'Noto Sans'`. Italic per script is a toggled class, so a style can italicise Tamil alone. The CI tofu gate enforces glyph coverage.

### Named Rules
**The Page Owns Personality Rule.** Chrome never uses a display face, and never an italic or a serif. If a piece of text looks stylish, it belongs to the page and not to the UI.

**The Point-Size Rule.** Screenplay elements are sized in `pt`, so on-screen sizing matches the PDF and DOCX export. Chrome is sized in `px`. Never mix them.

## Layout

The page is a single centered column, `.cs-editor-mount`, capped at **960px** and filling the width below that. It sits in `.cs-main` with 40px vertical and 16px horizontal padding. The source view shares that column. Element margins are percentages (for example 10% and 8% for action, 17% for dialogue) with an 8px floor, so the page degrades gracefully rather than overflowing.

The shell is a vertical flex stack: 40px app bar, element toolbar, workspace, status bar. The workspace is the page plus the navigator drawer, which is `min(33%, 400px)` wide with 180px and 480px bounds. It is a fixed side panel on desktop. The shell uses `100dvh` and safe-area insets.

Responsive behavior has two main breakpoints:
- **≤768px:** the app bar collapses to essentials and a mobile control group. File-pill widths are capped and desktop-only groups are hidden.
- **≤640px:** the navigator becomes a mobile drawer, and the toolbar buttons grow to 36×34 with a sticky overflow button. Dialogs and panels use touch-scale layouts.

Spacing rhythm is tight and 4px-based: 4, 8, 12, 16. Chrome rows use 8–12px padding, and controls sit at 28px (app bar) or 28–34px (toolbar).

## Elevation & Depth

Flat by default, with hairlines for structure. Depth is expressed by tone (dark rail over cream over white) and 1px borders, not by shadow. Shadows appear only on things that float above the page.

### Shadow Vocabulary
- **Tooltip** (`0 4px 12px rgba(0,0,0,0.45)`): dark tooltips on the toolbar and app bar.
- **Popover / menu** (`0 4px 16px rgba(0,0,0,0.12–0.25)`): dropdowns and menus.
- **Dialog** (`0 8px 32px rgba(0,0,0,0.18)`) over a `rgba(0,0,0,0.35)` scrim: modal dialogs.
- **Drawer** (`4px 0 24px rgba(0,0,0,0.35)`): the mobile navigator.
- **Primary button hover** (`0 1px 6px rgba(0,0,0,0.35)`): the only shadow that appears on a control.

### Named Rules
**The Flat-At-Rest Rule.** No surface carries a shadow while idle. A shadow means something is floating or being pressed.

## Shapes

Small, quiet corners. **4px** is the default for buttons, inputs, tooltips and menu items. **2–3px** is for micro chips and synopsis fields. **6px** is for panels and cards. **8px** is for dialogs. **14px** pill is reserved for the app bar file-name pill, and 50% for dots. Borders are 1px in Rule Light. The only thick line in the system is the 2px tungsten left edge on notes. The page itself has no rounded corners.

## Components

### App bar
A 40px obsidian rail with a 1px near-black bottom border. It holds the monogram and wordmark, a file-name pill (monospace, 14px radius, white at 6% fill), and 28px icon buttons (4px radius, no fill at rest, warm-white 12% on hover, 18% when active). The **primary** action is filled tungsten with white text and an amber-edge border. A **secondary** action gets a white 16% border. Tooltips open downward.

### Element toolbar
A Toolbar Paper strip of 32×28 icon buttons in `#3d3d38`. Hover gives a white fill and a `#d8d6cc` border. The **active** state is inverted, ink-black fill with white glyph, and is the only strongly dark control on the light chrome. Tooltips are near-black with a sigil and a shortcut hint.

### Scene navigator
A cream drawer holding the frontmatter button and a scene list. Each row shows scene number, heading, an optional inline-editable synopsis (11px, 3px radius, focus is a tungsten border with no glow), and a status chip. Chips are 9px uppercase with a 2px radius. Rows highlight on hover, take Amber Wash when active, and show a drop-target treatment while dragging.

### Dialogs
White, 8px radius, 340–480px wide, on a 35% black scrim. The header is 14×16px padded with a 1px `#e8e8e4` divider and a 15px semibold title. Larger dialogs (settings, title page, style, find and replace) follow the same header, body and footer structure and use tabbed layouts with a 2px focus-visible outline.

### Status bar
Panel Cream with a 1px top rule and Ink Secondary text. It carries a dirty dot in Tungsten Badge and Ink for the strong values.

### Notes and comments (on the page)
Block notes sit on Note Wash with a 2px tungsten left edge at 10pt. **Inline notes** use a highlight rather than the block background and border. Comments are 10pt italic and low contrast. Their colors are style-driven variables.

### Signature: style-driven page
Every page element reads its font size, color, weight, style, decoration, alignment and margins from `--cs-<element>-*` variables set on `.cs-editor-mount` from the document's resolved screenplay style. Built-in styles are **Classic** (Noto Sans, teal headings, rust cues), **Traditional** (Noto Serif, upright serif, underlined cues, italic Tamil) and **Industry Courier** (Courier Prime, monochrome, flush-left). Users can add their own styles. The same definition drives the editor, PDF and DOCX, so what you see is what exports.

## Do's and Don'ts

### Do:
- **Do** bind chrome to `--cs-ui-*` variables and screenplay elements to `--cs-<element>-*` variables, with a hex fallback in each `var()`.
- **Do** reserve tungsten for the primary action, the active state, focus and the dirty indicator.
- **Do** express depth with tone and a 1px Rule Light hairline first, and add a shadow only for floating layers.
- **Do** size screenplay text in `pt` and chrome in `px`, with 12px as the default chrome size.
- **Do** keep any new element behavior, sigils and reserved keys consistent with `docs/sutra_format_spec.md`.
- **Do** give every icon button a tooltip that shows its shortcut.
- **Do** test every new surface at ≤768px and ≤640px, and with an Indic script on the page.

### Don't:
- **Don't** add a second accent hue, gradients on chrome (the monogram tile is the sole exception), or glow effects.
- **Don't** use pure `#000` or cool grey. Stay on the warm neutral ramp.
- **Don't** use accent side-stripes on cards or list items. The 2px note edge is the only one, and it belongs to the page.
- **Don't** hardcode colors, sizes or margins for a screenplay element in CSS. They come from the active style.
- **Don't** add decorative illustrations, gamification badges, or nested cards. Sutrata is an Operate-mode tool.
- **Don't** put chrome text in a serif, an italic or a display face.
- **Don't** reuse Classic's teal or rust in the UI.
- **Don't** describe or reintroduce the retired clapper "C" monogram.
