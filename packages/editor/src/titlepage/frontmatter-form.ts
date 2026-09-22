/**
 * Title page form ⇄ Sutra frontmatter.
 *
 * `readTitlePage` turns the parsed frontmatter into form state. `writeTitlePage` writes the
 * form back into the Sutra text by editing only the frontmatter lines of keys whose
 * value actually changed. Every other line (unknown keys, nested maps the form does not
 * manage, comments, ordering, formatting) is kept byte for byte, so opening the form and
 * saving without edits leaves the file unchanged.
 *
 * Values are written in the subset the parser's minimal YAML reader understands: plain
 * scalars, `key: |` block scalars, one level of nested map (multilingual `title:`), and
 * `[a, b]` flow lists (kept as strings by the parser and split by readers).
 */

export type PageSize = '' | 'A4' | 'Letter'

export interface AltTitle { lang: string; text: string }
export interface CustomField { key: string; value: string }

export interface TitlePageForm {
  // Title & story
  title: string
  altTitles: AltTitle[]
  logline: string
  // Credits
  author: string
  credit: string
  source: string
  story: string
  screenplay: string
  dialogue: string
  // Draft
  draft: string
  revision: string
  date: string
  // Contact & rights
  contact: string
  copyright: string
  // Document settings
  lang: string
  langSecondary: string[]
  page: PageSize
  style: string
  watermark: string
  // Simple custom keys, editable as rows
  custom: CustomField[]
}

/** Keys the form edits directly (in the order new keys are appended). */
export const MANAGED_KEYS = [
  'title', 'logline', 'author', 'credit', 'source', 'story', 'screenplay', 'dialogue',
  'draft', 'revision', 'date', 'contact', 'copyright',
  'lang', 'lang-secondary', 'page', 'style', 'watermark',
] as const

type ManagedKey = typeof MANAGED_KEYS[number]

/** Keys kept but never shown as editable custom rows. */
const HIDDEN_KEYS = new Set(['format'])

const KEY_RE = /^([A-Za-z0-9_-]+):(.*)$/

export function emptyForm(): TitlePageForm {
  return {
    title: '', altTitles: [], logline: '',
    author: '', credit: '', source: '', story: '', screenplay: '', dialogue: '',
    draft: '', revision: '', date: '',
    contact: '', copyright: '',
    lang: '', langSecondary: [], page: '', style: '', watermark: '',
    custom: [],
  }
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : v === undefined || v === null ? '' : String(v)
}

/** Split a list value: `[a, b]`, `a, b`, or an array. */
export function splitList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(x => str(x).trim()).filter(Boolean)
  return str(v).replace(/^\s*\[|\]\s*$/g, '').split(',')
    .map(x => x.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean)
}

function normalizePage(v: string): PageSize {
  const p = v.trim().toLowerCase()
  if (p === 'a4') return 'A4'
  if (p === 'letter' || p === 'us-letter' || p === 'usletter') return 'Letter'
  return ''
}

/** Build form state from parsed frontmatter data. */
export function readTitlePage(data: Record<string, unknown> | undefined): TitlePageForm {
  const f = emptyForm()
  if (!data) return f
  f.lang = str(data['lang']).trim()

  const title = data['title']
  if (title && typeof title === 'object' && !Array.isArray(title)) {
    const map = title as Record<string, unknown>
    const keys = Object.keys(map)
    const primary = keys.includes(f.lang) ? f.lang : keys[0]
    if (primary !== undefined) f.title = str(map[primary])
    f.altTitles = keys.filter(k => k !== primary).map(k => ({ lang: k, text: str(map[k]) }))
    // Remember which language key held the main title.
    if (primary !== undefined && !f.lang) f.lang = primary
  } else {
    f.title = str(title)
  }

  f.logline = str(data['logline'])
  f.author = str(data['author'])
  f.credit = str(data['credit'])
  f.source = str(data['source'])
  f.story = str(data['story'])
  f.screenplay = str(data['screenplay'])
  f.dialogue = str(data['dialogue'])
  f.draft = str(data['draft'])
  f.revision = str(data['revision'])
  f.date = str(data['date'])
  f.contact = str(data['contact'])
  f.copyright = str(data['copyright'])
  f.langSecondary = splitList(data['lang-secondary'])
  f.page = normalizePage(str(data['page']))
  f.style = str(data['style'])
  f.watermark = str(data['watermark'])

  const managed = new Set<string>(MANAGED_KEYS)
  for (const [key, value] of Object.entries(data)) {
    if (managed.has(key) || HIDDEN_KEYS.has(key)) continue
    if (typeof value === 'string' && !value.includes('\n')) f.custom.push({ key, value })
  }
  return f
}

// ── Writing ─────────────────────────────────────────────────────────────────────────

function scalarLines(key: string, value: string): string[] | null {
  const v = value.replace(/\s+$/g, '')
  if (v.trim() === '') return null
  if (v.includes('\n')) {
    return [`${key}: |`, ...v.split('\n').map(l => (l ? `  ${l}` : ''))]
  }
  return [`${key}: ${v.trim()}`]
}

function oneLine(v: string): string {
  return v.replace(/\s*\n\s*/g, ' ').trim()
}

/** Lines for a managed key, or null to remove it. */
function managedLines(key: ManagedKey, f: TitlePageForm): string[] | null {
  switch (key) {
    case 'title': {
      const alts = f.altTitles.filter(a => a.lang.trim() && a.text.trim())
      if (alts.length === 0) return scalarLines('title', oneLine(f.title))
      const primaryKey = f.lang.trim() || 'und'
      const lines = ['title:']
      if (f.title.trim()) lines.push(`  ${primaryKey}: ${oneLine(f.title)}`)
      for (const a of alts) if (a.lang.trim() !== primaryKey) lines.push(`  ${a.lang.trim()}: ${oneLine(a.text)}`)
      return lines
    }
    case 'lang-secondary': {
      const list = f.langSecondary.map(l => l.trim()).filter(Boolean)
      return list.length ? [`lang-secondary: [${list.join(', ')}]`] : null
    }
    case 'page': return f.page ? [`page: ${f.page}`] : null
    case 'logline': return scalarLines('logline', oneLine(f.logline))
    case 'contact': return scalarLines('contact', f.contact)
    default: {
      const field = ({
        author: f.author, credit: f.credit, source: f.source, story: f.story,
        screenplay: f.screenplay, dialogue: f.dialogue, draft: f.draft, revision: f.revision,
        date: f.date, copyright: f.copyright, lang: f.lang, style: f.style, watermark: f.watermark,
      } as Record<string, string>)[key] ?? ''
      return scalarLines(key, oneLine(field))
    }
  }
}

/** Semantic value of a managed key, for change detection. */
function managedValue(key: ManagedKey, f: TitlePageForm): string {
  return JSON.stringify(managedLines(key, f))
}

interface Entry { key: string | null; lines: string[] }

function splitEntries(yamlLines: string[]): Entry[] {
  const entries: Entry[] = []
  for (const line of yamlLines) {
    const m = KEY_RE.exec(line)
    if (m) entries.push({ key: m[1]!, lines: [line] })
    else if (entries.length > 0) entries[entries.length - 1]!.lines.push(line)
    else entries.push({ key: null, lines: [line] })
  }
  return entries
}

/**
 * Write `next` into `text`'s frontmatter. `original` is the form as read from the same
 * text; only keys whose value differs between the two are rewritten.
 */
export function writeTitlePage(text: string, original: TitlePageForm, next: TitlePageForm): string {
  const eol = text.includes('\r\n') ? '\r\n' : '\n'
  const lines = text.split(/\r?\n/)

  let yamlLines: string[] = []
  let bodyLines = lines
  let hadFrontmatter = false
  if (lines[0] === '---') {
    const close = lines.indexOf('---', 1)
    if (close > 0) {
      hadFrontmatter = true
      yamlLines = lines.slice(1, close)
      bodyLines = lines.slice(close + 1)
    }
  }

  const entries = splitEntries(yamlLines)
  const present = new Set(entries.map(e => e.key).filter((k): k is string => k !== null))

  // Managed keys that changed → their new lines (null = remove).
  const changes = new Map<string, string[] | null>()
  for (const key of MANAGED_KEYS) {
    if (managedValue(key, original) !== managedValue(key, next)) changes.set(key, managedLines(key, next))
  }
  // Primary language key of a multilingual title follows `lang`.
  if (next.altTitles.some(a => a.text.trim()) && original.lang !== next.lang) {
    changes.set('title', managedLines('title', next))
  }

  // Custom rows: edited, removed, or added.
  const origCustom = new Map(original.custom.map(c => [c.key, c.value]))
  const nextCustom = new Map<string, string>()
  for (const c of next.custom) {
    const k = c.key.trim()
    if (!/^[A-Za-z0-9_-]+$/.test(k) || (MANAGED_KEYS as readonly string[]).includes(k)) continue
    nextCustom.set(k, c.value)
  }
  for (const [k, v] of origCustom) {
    if (!nextCustom.has(k)) changes.set(k, null)
    else if (nextCustom.get(k) !== v) changes.set(k, scalarLines(k, oneLine(nextCustom.get(k)!)))
  }
  for (const [k, v] of nextCustom) {
    if (!origCustom.has(k)) changes.set(k, scalarLines(k, oneLine(v)))
  }

  if (changes.size === 0) return text

  const out: string[] = []
  for (const e of entries) {
    if (e.key !== null && changes.has(e.key)) {
      const replacement = changes.get(e.key)
      if (replacement) out.push(...replacement)
      changes.delete(e.key)
    } else {
      out.push(...e.lines)
    }
  }
  // Keys not present before: managed keys in canonical order, then custom keys.
  for (const key of MANAGED_KEYS) {
    if (!present.has(key) && changes.has(key)) {
      const add = changes.get(key)
      if (add) out.push(...add)
      changes.delete(key)
    }
  }
  for (const [, add] of changes) if (add) out.push(...add)

  const hasContent = out.some(l => l.trim() !== '')
  if (!hasContent) {
    // Everything removed: drop the frontmatter block and the blank line after it.
    const rest = hadFrontmatter && bodyLines[0] === '' ? bodyLines.slice(1) : bodyLines
    return rest.join(eol)
  }
  if (!hadFrontmatter) {
    return ['---', ...out, '---', '', ...lines].join(eol)
  }
  return ['---', ...out, '---', ...bodyLines].join(eol)
}
