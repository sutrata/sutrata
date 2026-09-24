/**
 * Lossless editor serializer (OSS spec §11.6): for any Sutra document,
 * parse → sutraToProsemirror → prosemirrorToSutra → parse yields the same AST
 * as the first parse (ignoring `raw`, which records source formatting).
 */
import { readFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import fc from 'fast-check'
import { parse } from '@sutrata/parser'
import { Fragment, Slice } from 'prosemirror-model'
import { schema } from '../src/editor/schema'
import { sutraToProsemirror } from '../src/editor/sutra-to-prosemirror'
import { prosemirrorToSutra } from '../src/editor/prosemirror-to-sutra'

const CONFORMANCE_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../parser/conformance')

function stripRaw(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripRaw)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).filter(([k]) => k !== 'raw').map(([k, v]) => [k, stripRaw(v)]))
  }
  return value
}

function editorRoundTrip(source: string): string {
  return prosemirrorToSutra(sutraToProsemirror(parse(source)))
}

function expectLossless(source: string) {
  const regenerated = editorRoundTrip(source)
  expect(stripRaw(parse(regenerated))).toEqual(stripRaw(parse(source)))
  // Stable: a second pass through the editor changes nothing.
  expect(editorRoundTrip(regenerated)).toBe(regenerated)
}

describe('lossless editor round-trip: conformance corpus', () => {
  const files = readdirSync(CONFORMANCE_DIR).filter(f => f.endsWith('.sutra'))
  for (const file of files) {
    it(file, () => expectLossless(readFileSync(join(CONFORMANCE_DIR, file), 'utf-8')))
  }

  it('re-emits untouched frontmatter byte for byte (comments, lists, quoting)', () => {
    const fm = '---\n# drafts go here\ntitle: "Quoted"\nlang-secondary:\n  - en\n  - ta\nlang: hi\n---\n'
    expect(editorRoundTrip(fm + '\nAction.\n')).toBe(fm + '\nAction.\n')
  })
})

describe('title page edits keep the rest of the frontmatter', () => {
  it('rewrites only the changed key', () => {
    const src = '---\n# drafts go here\ntitle:\n  hi: पुराना\n  en: Old\nlang-secondary:\n  - en\nauthor: A\n---\n\nAction.\n'
    const doc = sutraToProsemirror(parse(src))
    let from = -1
    let to = -1
    doc.firstChild!.forEach((field, offset) => {
      if (field.attrs['fmKey'] === 'author') { from = 1 + offset + 1; to = 1 + offset + field.nodeSize - 1 }
    })
    const edited = doc.replace(from, to, new Slice(Fragment.from(schema.text('B')), 0, 0))
    expect(prosemirrorToSutra(edited)).toBe(src.replace('author: A', 'author: B'))
  })
})

describe('lossless editor round-trip: known gaps', () => {
  it('bold+italic keeps both marks', () => expectLossless('A ***big*** and **bold *mixed* run** here.\n'))
  it('cues outside any scene are kept', () => expectLossless('@NARRATOR\nOnce upon a time.\n\n## INT. X\n\nAction.\n'))
  it('character registry metadata is kept', () =>
    expectLossless('# Characters {#characters}\n\n@VIKRAM\n& actor: Ranbir\n& aliases:\n  - Vicky\n'))
  it('multi-line comments keep their line breaks', () => expectLossless('<!-- first\n\nsecond -->\n\nAction.\n'))
  it('multi-line lyrics, centered and transition blocks', () =>
    expectLossless('~ one *two*\n~ three\n\n>> A <<\n>> B <<\n\n>> CUT TO:\n>> LATER\n'))
  it('heading, section and cue attributes', () =>
    expectLossless('# Act {#act1 x-k="v w"}\n\n## INT. X {#1 lang=en .flash}\n\n@A (V.O.) ^ {lang=hi}\nहाँ।\n'))
})

// ── Property test ────────────────────────────────────────────────────────────

const word = fc.constantFrom(
  'rain', 'Meera', 'VIKRAM', 'door', 'platform', '12', 'train',
  'मीरा', 'विक्रम', 'स्टेशन', 'रात', 'क्षमा', 'வணக்கம்', 'ரயில்', 'ਪੰਜਾਬ', 'ধন্যবাদ', 'ශ්‍රී',
)
const words = fc.array(word, { minLength: 1, maxLength: 5 }).map(ws => ws.join(' '))

/** A run of words, optionally wrapped in one emphasis form; runs are space-separated. */
const inlineRun = fc.tuple(words, fc.constantFrom('', '*', '**', '***', '_', '[[')).map(([w, d]) =>
  d === '[[' ? `[[${w}]]` : `${d}${w}${d}`)
const inlineText = fc.array(inlineRun, { minLength: 1, maxLength: 4 }).map(rs => rs.join(' '))

const attrKey = fc.constantFrom('lang', 'x-unit', 'x-cam', 'rev')
const attrValue = fc.oneof(fc.constantFrom('en', 'hi', 'blue', '2'), words)
const attrBlock = fc.record({
  id: fc.option(fc.constantFrom('1', '12A', 'sc7', 'synopsis'), { nil: undefined }),
  attrs: fc.array(fc.tuple(attrKey, attrValue), { maxLength: 2 }),
}).map(({ id, attrs }) => {
  const parts = [...(id ? [`#${id}`] : []), ...attrs.map(([k, v]) => (/\s/.test(v) ? `${k}="${v}"` : `${k}=${v}`))]
  return parts.length ? ` {${parts.join(' ')}}` : ''
})

const metaKey = fc.constantFrom('synopsis', 'status', 'location', 'actors', 'x-budget-code', 'props')
const metadata = fc.oneof(
  fc.tuple(metaKey, words).map(([k, v]) => `& ${k}: ${v}`),
  fc.tuple(fc.constantFrom('shots', 'x-list'), fc.array(words, { minLength: 1, maxLength: 3 }))
    .map(([k, items]) => [`& ${k}:`, ...items.map(i => `  - ${i}`)].join('\n')),
)

const cue = fc.tuple(words, fc.constantFrom('', ' (V.O.)', ' (O.S.)'), fc.boolean(), attrBlock)
  .map(([name, ext, dual, attrs]) => `@${name}${ext}${dual ? ' ^' : ''}${attrs}`)
const dialogueBlock = fc.tuple(cue, fc.array(fc.oneof(inlineText, words.map(w => `(${w})`)), { minLength: 1, maxLength: 3 }))
  .map(([c, lines]) => [c, ...lines].join('\n'))

const bodyBlock = fc.oneof(
  { weight: 4, arbitrary: fc.array(inlineText, { minLength: 1, maxLength: 2 }).map(ls => ls.join('\n')) },  // action
  { weight: 4, arbitrary: dialogueBlock },
  { weight: 1, arbitrary: words.map(w => `>> ${w}`) },
  { weight: 1, arbitrary: fc.array(words, { minLength: 1, maxLength: 2 }).map(ls => ls.map(l => `>> ${l} <<`).join('\n')) },
  { weight: 1, arbitrary: fc.array(inlineText, { minLength: 1, maxLength: 3 }).map(ls => ls.map(l => `~ ${l}`).join('\n')) },
  { weight: 1, arbitrary: words.map(w => `[[ ${w} ]]`) },
  { weight: 1, arbitrary: words.map(w => `<!-- ${w} -->`) },
  { weight: 1, arbitrary: fc.constant('===') },
)

const scene = fc.tuple(words, attrBlock, fc.array(metadata, { maxLength: 3 }), fc.array(bodyBlock, { maxLength: 5 }))
  .map(([text, attrs, meta, body]) => [[`## ${text}${attrs}`, ...meta].join('\n'), ...body].join('\n\n'))

const section = fc.tuple(words, attrBlock).map(([t, a]) => `# ${t}${a}`)

const registry = fc.array(
  fc.tuple(words, fc.array(metadata, { minLength: 1, maxLength: 3 })).map(([n, meta]) => [`@${n}`, ...meta].join('\n')),
  { minLength: 1, maxLength: 3 },
).map(entries => ['# Characters {#characters}', ...entries].join('\n\n'))

const frontmatter = fc.option(
  fc.record({
    title: fc.oneof(words.map(w => `title: ${w}`), fc.tuple(words, words).map(([a, b]) => `title:\n  hi: ${a}\n  en: ${b}`)),
    extra: fc.array(fc.tuple(fc.constantFrom('author', 'lang', 'x-studio', 'draft'), words).map(([k, v]) => `${k}: ${v}`), { maxLength: 3 }),
  }).map(({ title, extra }) => ['---', title, ...extra, '---'].join('\n') + '\n\n'),
  { nil: '' },
)

const document = fc.tuple(
  frontmatter,
  fc.array(bodyBlock, { maxLength: 2 }),
  fc.option(registry, { nil: undefined }),
  fc.array(fc.oneof({ weight: 1, arbitrary: section }, { weight: 4, arbitrary: scene }), { minLength: 1, maxLength: 4 }),
).map(([fm, intro, reg, parts]) => fm + [...intro, ...(reg ? [reg] : []), ...parts].join('\n\n') + '\n')

describe('lossless editor round-trip: generated documents', () => {
  it('parse → PM → Sutra → parse preserves the AST', () => {
    fc.assert(fc.property(document, source => {
      expectLossless(source)
    }), { numRuns: 300 })
  })
})
