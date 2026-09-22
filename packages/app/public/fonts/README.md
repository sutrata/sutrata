# Font Assets

This directory contains font files for Sutrata's multi-script screenplay editor. All fonts are committed to the repository.

### Courier Prime (Latin)

- `CourierPrime-400.woff2` (Regular)
- `CourierPrime-700.woff2` (Bold)

### Noto Sans (Latin body font and fallback)

- `NotoSans-latin-full-400.woff2` / `NotoSans-latin-full-700.woff2`

Subset from the full Noto Sans v2.015 variable font (google/fonts `ofl/notosans`), instanced
at wdth=100 and wght=400/700. Covers U+0000-02FF, U+0300-036F (combining marks), U+1D00-1DBF,
U+1E00-1EFF and common punctuation/currency, so every ISO 15919 letter used by romanized export
renders, including r̥, l̥ and m̐. Rebuild with:

```bash
python3 -m fontTools.varLib.instancer 'NotoSans[wdth,wght].ttf' wght=400 wdth=100 -o NotoSans-400.ttf
python3 -m fontTools.subset NotoSans-400.ttf --layout-features='*' --flavor=woff2 \
  --unicodes='U+0000-036F,U+1D00-1DBF,U+1E00-1EFF,U+2000-206F,U+20A0-20C0,U+2113,U+2122,U+2191,U+2193,U+2212,U+2215,U+2C60-2C7F,U+A720-A7FF,U+FEFF,U+FFFD' \
  --output-file=NotoSans-latin-full-400.woff2
```

### Noto Serif (Latin)

- `NotoSerif-latin-full-400.woff2` / `NotoSerif-latin-full-700.woff2` / `NotoSerif-Italic-latin-full-400.woff2`

Built the same way from `ofl/notoserif/NotoSerif[wdth,wght].ttf` (v2.015) and
`NotoSerif-Italic[wdth,wght].ttf` (v2.013), same unicode ranges. `scripts/check-font-coverage.py`
verifies all Noto Sans and Noto Serif Latin files in CI.

### Noto Sans Families (Indic Scripts)

- `NotoSansDevanagari-400.woff2` / `NotoSansDevanagari-700.woff2`
- `NotoSansTamil-400.woff2` / `NotoSansTamil-700.woff2`
- `NotoSansTelugu-400.woff2` / `NotoSansTelugu-700.woff2`
- `NotoSansKannada-400.woff2` / `NotoSansKannada-700.woff2`
- `NotoSansMalayalam-400.woff2` / `NotoSansMalayalam-700.woff2`
- `NotoSansBengali-400.woff2` / `NotoSansBengali-700.woff2`
- `NotoSansGujarati-400.woff2` / `NotoSansGujarati-700.woff2`
- `NotoSansGurmukhi-400.woff2` / `NotoSansGurmukhi-700.woff2`
- `NotoSansOriya-400.woff2` / `NotoSansOriya-700.woff2`

22 files total (1 Latin family + 9 Indic families, 2 weights each).

> Note: the file names above (`NotoSansDevanagari-400.woff2` style) predate a later
> per-subset split. The files actually committed follow the pattern documented for
> Sinhala below (`NotoSans-<Script>-script(-700).woff2` / `-latin(-ext)(-700).woff2`,
> 6 files per Sans family instead of 2) — this section needs a refresh to match.

### Noto Sans Sinhala / Noto Serif Sinhala

- `NotoSans-Sinhala-script.woff2` / `-script-700.woff2` — the Sinhala block itself
- `NotoSans-Sinhala-latin.woff2` / `-latin-700.woff2` — basic Latin, for mixed-script lines
- `NotoSans-Sinhala-latin-ext.woff2` / `-latin-ext-700.woff2` — Latin Extended, for ISO 15919 romanized names in mixed-script lines
- `NotoSerifSinhala-sinhala.woff2` / `-sinhala-700.woff2`, plus the same `-latin`/`-latin-ext` split (used by the Traditional style)

Subset from the variable fonts at `google/fonts` `ofl/notosanssinhala` (v2.006) and
`ofl/notoserifsinhala` (v2.007), instanced at wght=400/700, wdth=100, then split into
the three unicode-range buckets the rest of the Indic families use:

```bash
python3 -m fontTools.varLib.instancer 'NotoSansSinhala[wdth,wght].ttf' wght=400 wdth=100 -o NotoSansSinhala-400.ttf
python3 -m fontTools.subset NotoSansSinhala-400.ttf --layout-features='*' --flavor=woff2 \
  --unicodes='U+0964-0965,U+0D80-0DFF,U+200C-200D,U+20B9,U+25CC' \
  --output-file=NotoSans-Sinhala-script.woff2
# repeat with the latin / latin-ext unicode ranges used by every other Indic family
# (see fonts.css), and again at wght=700; same recipe for NotoSerifSinhala.
```

All fonts are declared in `packages/app/src/shell/fonts/fonts.css` via `@font-face` rules with unicode-range optimizations for zero-tofu rendering.
