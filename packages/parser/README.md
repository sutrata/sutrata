# @sutrata/parser

The reference parser for **Sutra**, a plain-text screenplay format based on Fountain and designed for world languages. Sutra stores Latin, Devanagari, Tamil, Telugu, Kannada, Malayalam, Bengali, Gujarati, Gurmukhi, Odia, Sinhala and other scripts natively, in logical order.

- Parses Sutra text into a typed AST, and serializes it back **byte for byte**: parse a file and serialize it unchanged, and you get identical text.
- Imports and exports [Fountain](https://fountain.io).
- Romanizes Indic scripts to Latin (ISO 15919, plus a readable and a diacritic-free colloquial variant) for export.
- Has no UI dependencies. It runs in Node and in the browser, and is ESM only.

This is the parser used by [Sutrata](https://github.com/sutrata/sutrata), a multilingual screenplay editor. The format itself is defined in the [Sutra format specification](https://github.com/sutrata/sutrata/blob/main/docs/sutra_format_spec.md), which anyone is free to implement.

## Install

```bash
npm install @sutrata/parser
```

## What Sutra looks like

```
---
title:
  en: Last Train
  hi: आख़िरी ट्रेन
lang: hi
page: A4
---

## INT. रेलवे स्टेशन - रात {#sc1}
& synopsis: मीरा और विक्रम सच जानते हैं।
& actors: मीरा, विक्रम

प्लेटफ़ॉर्म खाली है।

@मीरा
( धीरे से )
हम ट्रेन छूट गए, है ना?

>> CUT TO:
```

In this example:
- YAML frontmatter holds the title page (the title can be given in several languages).
- `##` starts a scene heading, and `{#sc1}` gives the scene a stable ID.
- `&` lines are scene metadata.
- `@` marks a character cue; the cue is followed by an optional parenthetical and the dialogue.
- `>>` marks a transition.

See the [format spec](https://github.com/sutrata/sutrata/blob/main/docs/sutra_format_spec.md) for the full grammar.

## Usage

### Parse and serialize

```ts
import { parse, serialize } from '@sutrata/parser'

const doc = parse(source)          // DocumentNode
doc.frontmatter?.data              // { title: { en: 'Last Train', hi: 'आख़िरी ट्रेन' }, lang: 'hi', ... }
doc.children                       // ContentNode[]: sections, scene headings, action, dialogue, ...

serialize(doc) === source          // true: round-trip is byte-faithful
```

Every node keeps the source text it was parsed from, and `serialize` writes that text back. Metadata keys, frontmatter keys and scene attributes that the parser doesn't recognise are **preserved, not dropped**, so files written by newer tools survive a round trip through older ones.

### Fountain

```ts
import { importFountain, fountainDocToSutra, exportFountain } from '@sutrata/parser'

const { document, warnings } = importFountain(fountainText)
const sutraText = fountainDocToSutra(document)

const { text, warnings: lost } = exportFountain(parse(sutraText))
// Fountain has no equivalent for some Sutra features (scene metadata, for example).
// `lost` lists what was dropped, e.g.
// 'metadata dropped in Fountain export for scene "INT. रेलवे स्टेशन - रात"'
```

### Romanization

```ts
import { romanize, romanizeSutra } from '@sutrata/parser'

romanize('हम ट्रेन छूट गए, है ना?', { variant: 'strict', languages: ['hi'] })
// 'hama ṭrēna chūṭa gaē, hai nā?'     (ISO 15919)
romanize('हम ट्रेन छूट गए, है ना?', { variant: 'readable', languages: ['hi'] })
// 'ham ṭren chūṭ gae, hai nā?'
romanize('हम ट्रेन छूट गए, है ना?', { variant: 'colloquial', languages: ['hi'] })
// 'ham tren chhoot gae, hai naa?'

// Romanize a whole Sutra document, or only its dialogue, and get Sutra back:
const romanized = romanizeSutra(source, { scope: 'dialogue', variant: 'readable' })
```

Romanization only converts to Latin; there is no way back to the native script. It's meant for exports, such as a romanized PDF for actors who don't read the script.

### Other exports

- `parseFrontmatter` / `serializeFrontmatter`: work on the frontmatter block on its own.
- `documentLanguages(frontmatterData)`: returns the document's languages, from `lang` and `lang-secondary`.
- `tokenize(line)`: the lexer for a single line.
- All AST node types: `DocumentNode`, `ContentNode`, `SceneHeadingNode`, `CharacterNode`, and the rest.

## License

[Apache-2.0](https://github.com/sutrata/sutrata/blob/main/packages/parser/LICENSE). The Sutra format specification is licensed CC BY 4.0.
