# Sutrata Design System & Brand Guide

## Brand Identity: The Clapper-Folio

The Sutrata brand identity merges the classic film slate / clapperboard with the clean folio silhouette of a printed screenplay page. It embodies both the rigorous discipline of cinematic production and the timeless craft of creative dramatic writing.

> **TODO:** this monogram was designed around the letter "C" for CineScript. It no longer
> fits the Sutrata name and needs a fresh design pass; the section below is kept only as a
> record of the current (outdated) mark.

### The Monogram & Logo Mark
- **Silhouette**: A rounded rectangular slate container (`rx="5"`, aspect ratio 1:1) framed with warm tungsten amber (`#d97706`).
- **Clapper Chevrons**: Three crisp diagonal chevron stripes angled across the top bar evoking the iconic wooden slate clapper sticks.
- **Folio Monogram**: A bold, open 'C' arc rendered with rounded endpoints, reminiscent of standard script binder rings and page curls.
- **Micro-Scale Legibility**: Optimized with high-contrast, stroke-width hierarchy (1.5px to 2.8px) ensuring unmistakable clarity at 16×16 favicon and 20×20 toolbar scales.

---

## Visual World: Cinema Noir & Amber Gold

The palette reflects the atmosphere of a dark screening room or production office under warm desk lamps.

### Core Color Palette

| Token / Color | Value | Usage |
|---|---|---|
| **Obsidian Dark** | `#141413` | Application chrome, AppBar background, dark frame |
| **Obsidian Surface** | `#1c1c1a` | Toolbar backgrounds, card surfaces, modal headers |
| **Obsidian Border** | `#2d2d2a` | Quiet structural panel dividers and button borders |
| **Tungsten Gold** | `#d97706` | Brand accent, primary active state, key highlights |
| **Amber Glow** | `#fbbf24` | Warm hover states, logo gradient stops |
| **Deep Amber** | `#92400e` | Selected indicators, pressed button tones |
| **Screenplay Cream** | `#fcfbfa` | Virtual page canvas background |
| **Screenplay Muted** | `#f4f2ea` | Navigator drawer background, side panel canvas |
| **Ink Black** | `#1a1a18` | Standard screenplay text typography |

---

## Typography

Sutrata respects screenwriting standard typographic specifications while providing clean UI system typography.

### 1. Screenplay Typography
- **Primary Typeface**: `Courier Prime` (Regular, Bold, Italic)
- **Standard Scale**: 12pt (16px in web display), line-height: 1.0em to 1.15em depending on element.
- **Indic Script Pairing**: Noto Sans Indic family (Devanagari, Tamil, Telugu, Kannada, Malayalam, Bengali, Gujarati, Gurmukhi, Odia) metric-matched with Courier Prime baseline.

### 2. UI Chrome Typography
- **System Sans**: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
- **Dense Hierarchy**:
  - Micro badges / tags: `10px` (Weight: 600, tracking: 0.5px)
  - Toolbar & Nav labels: `11px - 12px` (Weight: 500 - 600)
  - Dialog headings: `14px - 16px` (Weight: 700)

---

## Design Principles & Tokens

1. **Quiet Precision**: UI chrome never competes with the story. Controls use subdued grays and dark obsidian tones, stepping forward only with tungsten gold when active.
2. **Standard-Conscious**: Screenplay indentation margins, dual dialogue alignments, and pagination follow Hollywood standard physical formatting.
3. **No Decorative Slop**: Zero gratuitous accent side-bars, unnecessary cards, or generic SaaS widgets.
4. **Token Consistency**: All components bind to `--cs-ui-*` semantic variables for themes and interactive states.
