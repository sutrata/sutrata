/**
 * Indic → Latin romanization for romanized export.
 *
 * One way only: native-script text in, Latin text out. Output never feeds back into a
 * .sutra file, so it does not need to be reversible. Latin text, ASCII digits, punctuation,
 * Sutra sigils and markup pass through untouched, so a whole Sutra source can be
 * romanized line by line without breaking its syntax (see romanizeSutra).
 *
 * Nine of the ten supported scripts share the ISCII-derived Unicode block layout, so one
 * table keyed by the offset inside the 128-code-point block covers all of them, plus a few
 * per-script overrides; Sinhala has its own table. Script is detected per character from
 * its block, so mixed-script lines need no language tags.
 *
 * Variants:
 * - strict (default): ISO 15919 as tabulated. Every inherent vowel is written
 *   (राम → rāma); ':' separates sequences that would otherwise read as a digraph
 *   (अइ → a:i, क्ह → k:h).
 * - readable: for languages that drop it, the word-final inherent vowel is omitted in
 *   words of two or more syllables unless the final consonant closes a conjunct
 *   (राम → rām, मित्र → mitra, न → na); Indo-Aryan ē/ō are written e/o (मोहन → mohan);
 *   no ':' separators.
 * - colloquial: the informal, diacritic-free spelling people actually type (SMS/chat
 *   style, close to what Google's transliteration tools produce) — see below.
 *
 * The language that decides the readable/colloquial rules for a run is the first of
 * `languages` written in that run's script, else the script's default language.
 *
 * ### Colloquial variant
 *
 * ASCII only, no diacritics: long ī/ū are doubled (ee/oo) but ē/ō are written as a single
 * e/o like short e/o (मोहन → mohan, நேரம் → neram); ś/ṣ → sh, ṅ → ng, ñ → ny, ḷ → l,
 * ḻ → zh; retroflex ट/ड/ण collapse to the same spelling as dental त/द/न (an accepted,
 * common ambiguity in casual typing); anusvara becomes m before a labial consonant and n
 * elsewhere (संगीत → sangeet, संभव → sambhav); candrabindu → n (हाँ → haan); avagraha is
 * dropped; the word-final inherent vowel is dropped the same way as `readable`.
 *
 * Tamil is a special case: the script has one letter per place of articulation for what
 * are, phonetically, voiced/voiceless pairs, and casual typists resolve the ambiguity by
 * position, not by picking one spelling per letter. This module reproduces the
 * well-documented pattern: க/ட/ப are voiceless (k/t/p) word-initially, when geminated, or
 * bare (virama, no vowel); voiced (g/d/b) elsewhere. ச is "s" except when bare or
 * geminated, where it is "ch". த is always "th" (kept distinct from ற, which is "t" bare
 * and "tr" with a vowel).
 *
 * This is a deterministic, documented rule set, not a reproduction of any specific
 * commercial tool. Tools such as Google's transliteration IME are trained statistical
 * models and can spell the same letter differently in different words; that behavior
 * cannot be reverse-engineered from a handful of examples, and this module does not try
 * to match it letter-for-letter — only to produce spelling a reader would recognize as
 * the common casual convention.
 */

export type RomanizeVariant = 'strict' | 'readable' | 'colloquial'

export interface RomanizeOptions {
  /** Default 'strict'. */
  variant?: RomanizeVariant
  /** Document languages as BCP-47 tags, primary first (frontmatter `lang`, then
   *  `lang-secondary`). Used only to pick readable/colloquial rules per script. */
  languages?: string[]
}

type ScriptId = 'deva' | 'beng' | 'guru' | 'gujr' | 'orya' | 'taml' | 'telu' | 'knda' | 'mlym' | 'sinh'

const BLOCKS: Array<[ScriptId, number]> = [
  ['deva', 0x0900], ['beng', 0x0980], ['guru', 0x0a00], ['gujr', 0x0a80], ['orya', 0x0b00],
  ['taml', 0x0b80], ['telu', 0x0c00], ['knda', 0x0c80], ['mlym', 0x0d00], ['sinh', 0x0d80],
]

const DEFAULT_LANG: Record<ScriptId, string> = {
  deva: 'hi', beng: 'bn', guru: 'pa', gujr: 'gu', orya: 'or',
  taml: 'ta', telu: 'te', knda: 'kn', mlym: 'ml', sinh: 'si',
}

const LANG_SCRIPT: Record<string, ScriptId> = {
  hi: 'deva', mr: 'deva', sa: 'deva', ne: 'deva', kok: 'deva', mai: 'deva', bho: 'deva',
  awa: 'deva', raj: 'deva', hne: 'deva', mag: 'deva', doi: 'deva', bra: 'deva', sd: 'deva',
  bn: 'beng', as: 'beng', pa: 'guru', gu: 'gujr', or: 'orya',
  ta: 'taml', te: 'telu', kn: 'knda', tcy: 'knda', ml: 'mlym', si: 'sinh',
}

/** Languages whose word-final inherent vowel is not pronounced. */
const FINAL_SCHWA_DROP = new Set([
  'hi', 'mr', 'pa', 'gu', 'bn', 'as', 'ne', 'kok', 'mai', 'bho', 'awa', 'raj', 'hne', 'mag',
  'doi', 'bra', 'sd',
])

/** Indo-Aryan languages: no short/long e and o contrast, so readable/colloquial write e/o. */
const INDO_ARYAN = new Set([...FINAL_SCHWA_DROP, 'or', 'sa'])

// ── ISO 15919 tables, keyed by offset within the block ─────────────────────────────

const VOWELS: Record<number, string> = {
  0x05: 'a', 0x06: 'ā', 0x07: 'i', 0x08: 'ī', 0x09: 'u', 0x0a: 'ū', 0x0b: 'r̥', 0x0c: 'l̥',
  0x0d: 'ê', 0x0e: 'e', 0x0f: 'ē', 0x10: 'ai', 0x11: 'ô', 0x12: 'o', 0x13: 'ō', 0x14: 'au',
  0x60: 'r̥̄', 0x61: 'l̥̄',
}

const VOWEL_SIGNS: Record<number, string> = {
  0x3e: 'ā', 0x3f: 'i', 0x40: 'ī', 0x41: 'u', 0x42: 'ū', 0x43: 'r̥', 0x44: 'r̥̄', 0x45: 'ê',
  0x46: 'e', 0x47: 'ē', 0x48: 'ai', 0x49: 'ô', 0x4a: 'o', 0x4b: 'ō', 0x4c: 'au',
  0x56: 'ai', 0x57: 'au', 0x62: 'l̥', 0x63: 'l̥̄',
}

const CONSONANTS: Record<number, string> = {
  0x15: 'k', 0x16: 'kh', 0x17: 'g', 0x18: 'gh', 0x19: 'ṅ',
  0x1a: 'c', 0x1b: 'ch', 0x1c: 'j', 0x1d: 'jh', 0x1e: 'ñ',
  0x1f: 'ṭ', 0x20: 'ṭh', 0x21: 'ḍ', 0x22: 'ḍh', 0x23: 'ṇ',
  0x24: 't', 0x25: 'th', 0x26: 'd', 0x27: 'dh', 0x28: 'n', 0x29: 'ṉ',
  0x2a: 'p', 0x2b: 'ph', 0x2c: 'b', 0x2d: 'bh', 0x2e: 'm',
  0x2f: 'y', 0x30: 'r', 0x31: 'ṟ', 0x32: 'l', 0x33: 'ḷ', 0x34: 'ḻ', 0x35: 'v',
  0x36: 'ś', 0x37: 'ṣ', 0x38: 's', 0x39: 'h',
}

/** Precomposed nukta letters at 0x58–0x5F. Only these four blocks use that layout (NFC
 *  decomposes most of them anyway); in Telugu, Kannada and Malayalam the same offsets
 *  hold unrelated letters. */
const PRECOMPOSED_NUKTA: Record<number, string> = {
  0x58: 'q', 0x59: 'k͟h', 0x5a: 'ġ', 0x5b: 'z', 0x5c: 'ṛ', 0x5d: 'ṛh', 0x5e: 'f', 0x5f: 'ẏ',
}
const HAS_PRECOMPOSED_NUKTA = new Set<ScriptId>(['deva', 'beng', 'guru', 'orya'])

/** Consonant + nukta, keyed by the base consonant's offset. */
const NUKTA: Record<number, string> = {
  0x15: 'q', 0x16: 'k͟h', 0x17: 'ġ', 0x1c: 'z', 0x21: 'ṛ', 0x22: 'ṛh', 0x2b: 'f', 0x2f: 'ẏ',
}

const SCRIPT_CONSONANTS: Partial<Record<ScriptId, Record<number, string>>> = {
  beng: { 0x70: 'r', 0x71: 'w' },   // Assamese ৰ, ৱ
  orya: { 0x71: 'w' },              // ୱ
  knda: { 0x5e: 'ḻ' },              // ೞ
  telu: { 0x58: 'ts', 0x59: 'dz' }, // ౘ ౙ
}

/** Consonants written without an inherent vowel ("dead" consonants). Shared by both
 *  variants — the romanization is already plain ASCII. */
const DEAD_CONSONANTS: Partial<Record<ScriptId, Record<number, string>>> = {
  telu: { 0x5d: 'n' },              // nakaara pollu
  knda: { 0x5d: 'n' },              // nakaara pollu
}

/** Malayalam chillu letters: consonants with no inherent vowel. */
const CHILLU: Record<number, string> = {
  0x54: 'm', 0x55: 'y', 0x56: 'ḻ', 0x7a: 'ṇ', 0x7b: 'n', 0x7c: 'r', 0x7d: 'l', 0x7e: 'ḷ', 0x7f: 'k',
}

/**
 * Sinhala does not follow the ISCII-derived layout, so it has its own table keyed by the
 * offset inside U+0D80–0DFF. Prenasalized stops use the ISO 15919 breve (n̆d, m̆b).
 * Sinhala pronounces its inherent vowel, so the readable variant only drops ':'.
 */
type SinhalaKind = 'vowel' | 'sign' | 'cons' | 'virama' | 'anusvara' | 'visarga' | 'digit' | 'punct'
const SINHALA: Record<number, [SinhalaKind, string]> = {
  0x02: ['anusvara', 'ṁ'], 0x03: ['visarga', 'ḥ'],
  0x05: ['vowel', 'a'], 0x06: ['vowel', 'ā'], 0x07: ['vowel', 'æ'], 0x08: ['vowel', 'ǣ'],
  0x09: ['vowel', 'i'], 0x0a: ['vowel', 'ī'], 0x0b: ['vowel', 'u'], 0x0c: ['vowel', 'ū'],
  0x0d: ['vowel', 'r̥'], 0x0e: ['vowel', 'r̥̄'], 0x0f: ['vowel', 'l̥'], 0x10: ['vowel', 'l̥̄'],
  0x11: ['vowel', 'e'], 0x12: ['vowel', 'ē'], 0x13: ['vowel', 'ai'], 0x14: ['vowel', 'o'],
  0x15: ['vowel', 'ō'], 0x16: ['vowel', 'au'],
  0x1a: ['cons', 'k'], 0x1b: ['cons', 'kh'], 0x1c: ['cons', 'g'], 0x1d: ['cons', 'gh'],
  0x1e: ['cons', 'ṅ'], 0x1f: ['cons', 'n̆g'], 0x20: ['cons', 'c'], 0x21: ['cons', 'ch'],
  0x22: ['cons', 'j'], 0x23: ['cons', 'jh'], 0x24: ['cons', 'ñ'], 0x25: ['cons', 'jñ'],
  0x26: ['cons', 'n̆j'], 0x27: ['cons', 'ṭ'], 0x28: ['cons', 'ṭh'], 0x29: ['cons', 'ḍ'],
  0x2a: ['cons', 'ḍh'], 0x2b: ['cons', 'ṇ'], 0x2c: ['cons', 'n̆ḍ'], 0x2d: ['cons', 't'],
  0x2e: ['cons', 'th'], 0x2f: ['cons', 'd'], 0x30: ['cons', 'dh'], 0x31: ['cons', 'n'],
  0x33: ['cons', 'n̆d'], 0x34: ['cons', 'p'], 0x35: ['cons', 'ph'], 0x36: ['cons', 'b'],
  0x37: ['cons', 'bh'], 0x38: ['cons', 'm'], 0x39: ['cons', 'm̆b'], 0x3a: ['cons', 'y'],
  0x3b: ['cons', 'r'], 0x3d: ['cons', 'l'], 0x40: ['cons', 'v'], 0x41: ['cons', 'ś'],
  0x42: ['cons', 'ṣ'], 0x43: ['cons', 's'], 0x44: ['cons', 'h'], 0x45: ['cons', 'ḷ'],
  0x46: ['cons', 'f'],
  0x4a: ['virama', ''],
  0x4f: ['sign', 'ā'], 0x50: ['sign', 'æ'], 0x51: ['sign', 'ǣ'], 0x52: ['sign', 'i'],
  0x53: ['sign', 'ī'], 0x54: ['sign', 'u'], 0x56: ['sign', 'ū'], 0x58: ['sign', 'r̥'],
  0x59: ['sign', 'e'], 0x5a: ['sign', 'ē'], 0x5b: ['sign', 'ai'], 0x5c: ['sign', 'o'],
  0x5d: ['sign', 'ō'], 0x5e: ['sign', 'au'], 0x5f: ['sign', 'l̥'], 0x72: ['sign', 'r̥̄'],
  0x73: ['sign', 'l̥̄'],
  0x66: ['digit', '0'], 0x67: ['digit', '1'], 0x68: ['digit', '2'], 0x69: ['digit', '3'],
  0x6a: ['digit', '4'], 0x6b: ['digit', '5'], 0x6c: ['digit', '6'], 0x6d: ['digit', '7'],
  0x6e: ['digit', '8'], 0x6f: ['digit', '9'],
  0x74: ['punct', '.'],
}

// ── Colloquial tables (ASCII, no diacritics) ────────────────────────────────────────

const COLLOQUIAL_VOWELS: Record<number, string> = {
  0x05: 'a', 0x06: 'aa', 0x07: 'i', 0x08: 'ee', 0x09: 'u', 0x0a: 'oo', 0x0b: 'ri', 0x0c: 'li',
  0x0d: 'e', 0x0e: 'e', 0x0f: 'e', 0x10: 'ai', 0x11: 'o', 0x12: 'o', 0x13: 'o', 0x14: 'au',
  0x60: 'ri', 0x61: 'li',
}

const COLLOQUIAL_VOWEL_SIGNS: Record<number, string> = {
  0x3e: 'aa', 0x3f: 'i', 0x40: 'ee', 0x41: 'u', 0x42: 'oo', 0x43: 'ri', 0x44: 'ri', 0x45: 'e',
  0x46: 'e', 0x47: 'e', 0x48: 'ai', 0x49: 'o', 0x4a: 'o', 0x4b: 'o', 0x4c: 'au',
  0x56: 'au', 0x57: 'au', 0x62: 'li', 0x63: 'li',
}

/** Default consonant spellings: Devanagari/Bengali/Gurmukhi/Gujarati/Odia (which already
 *  distinguish voiced/voiceless/aspirated with separate letters, so no ambiguity) and
 *  Telugu/Kannada/Malayalam (same — these scripts inherited the full Sanskrit consonant
 *  set). Tamil overrides க/ச/ட/ப dynamically (see TAMIL_DYNAMIC) and த/ற statically below;
 *  it still falls back to this table for every other consonant (ங,ஞ,ண,ந,ன,ம,ய,ர,ல,ள,வ). */
const COLLOQUIAL_CONSONANTS: Record<number, string> = {
  0x15: 'k', 0x16: 'kh', 0x17: 'g', 0x18: 'gh', 0x19: 'ng',
  0x1a: 'ch', 0x1b: 'chh', 0x1c: 'j', 0x1d: 'jh', 0x1e: 'ny',
  0x1f: 't', 0x20: 'th', 0x21: 'd', 0x22: 'dh', 0x23: 'n',
  0x24: 't', 0x25: 'th', 0x26: 'd', 0x27: 'dh', 0x28: 'n', 0x29: 'n',
  0x2a: 'p', 0x2b: 'ph', 0x2c: 'b', 0x2d: 'bh', 0x2e: 'm',
  0x2f: 'y', 0x30: 'r', 0x31: 'r', 0x32: 'l', 0x33: 'l', 0x34: 'zh', 0x35: 'v',
  0x36: 'sh', 0x37: 'sh', 0x38: 's', 0x39: 'h',
}

const COLLOQUIAL_SCRIPT_CONSONANTS: Partial<Record<ScriptId, Record<number, string>>> = {
  beng: { 0x70: 'r', 0x71: 'w' },
  orya: { 0x71: 'w' },
  knda: { 0x5e: 'zh' },
  telu: { 0x58: 'ts', 0x59: 'dz' },
  // த is always "th" (kept distinct from ற below, whichever gets that sound elsewhere);
  // ற's vowel-bearing form is "tr" — its bare/virama form is "t" (TAMIL_BARE_OVERRIDE).
  taml: { 0x24: 'th', 0x31: 'tr' },
}

const COLLOQUIAL_PRECOMPOSED_NUKTA: Record<number, string> = {
  0x58: 'q', 0x59: 'kh', 0x5a: 'g', 0x5b: 'z', 0x5c: 'r', 0x5d: 'rh', 0x5e: 'f', 0x5f: 'y',
}
const COLLOQUIAL_NUKTA: Record<number, string> = {
  0x15: 'q', 0x16: 'kh', 0x17: 'g', 0x1c: 'z', 0x21: 'r', 0x22: 'rh', 0x2b: 'f', 0x2f: 'y',
}
const COLLOQUIAL_CHILLU: Record<number, string> = {
  0x54: 'm', 0x55: 'y', 0x56: 'zh', 0x7a: 'n', 0x7b: 'n', 0x7c: 'r', 0x7d: 'l', 0x7e: 'l', 0x7f: 'k',
}

/**
 * Tamil consonants that are, phonetically, voiced/voiceless pairs written with one
 * letter. `hard` (voiceless) is used word-initially (if `hardAtWordInitial`), when the
 * bare/virama form is written (always), and for the second half of a doubled pair;
 * `default` (voiced, for க/ட/ப — "s" for ச) is used everywhere else, chiefly
 * intervocalically and after a nasal.
 */
interface TamilDynamic { default: string; hard: string; hardAtWordInitial: boolean }
const TAMIL_DYNAMIC: Record<number, TamilDynamic> = {
  0x15: { default: 'g', hard: 'k', hardAtWordInitial: true },  // க
  0x1a: { default: 's', hard: 'ch', hardAtWordInitial: false }, // ச
  0x1f: { default: 'd', hard: 't', hardAtWordInitial: true },  // ட
  0x2a: { default: 'b', hard: 'p', hardAtWordInitial: true },  // ப
}
/** ற's bare/virama form ("t"), overriding its vowel-bearing default ("tr") at virama time. */
const TAML_RRA_OFFSET = 0x31

const COLLOQUIAL_SINHALA: Record<number, [SinhalaKind, string]> = {
  0x02: ['anusvara', 'n'], 0x03: ['visarga', 'h'],
  0x05: ['vowel', 'a'], 0x06: ['vowel', 'aa'], 0x07: ['vowel', 'ae'], 0x08: ['vowel', 'aae'],
  0x09: ['vowel', 'i'], 0x0a: ['vowel', 'ee'], 0x0b: ['vowel', 'u'], 0x0c: ['vowel', 'oo'],
  0x0d: ['vowel', 'ru'], 0x0e: ['vowel', 'ruu'], 0x0f: ['vowel', 'lu'], 0x10: ['vowel', 'luu'],
  0x11: ['vowel', 'e'], 0x12: ['vowel', 'ee'], 0x13: ['vowel', 'ai'], 0x14: ['vowel', 'o'],
  0x15: ['vowel', 'oo'], 0x16: ['vowel', 'au'],
  0x1a: ['cons', 'k'], 0x1b: ['cons', 'kh'], 0x1c: ['cons', 'g'], 0x1d: ['cons', 'gh'],
  0x1e: ['cons', 'ng'], 0x1f: ['cons', 'ng'], 0x20: ['cons', 'ch'], 0x21: ['cons', 'chh'],
  0x22: ['cons', 'j'], 0x23: ['cons', 'jh'], 0x24: ['cons', 'ny'], 0x25: ['cons', 'gy'],
  0x26: ['cons', 'nj'], 0x27: ['cons', 't'], 0x28: ['cons', 'th'], 0x29: ['cons', 'd'],
  0x2a: ['cons', 'dh'], 0x2b: ['cons', 'n'], 0x2c: ['cons', 'nd'], 0x2d: ['cons', 't'],
  0x2e: ['cons', 'th'], 0x2f: ['cons', 'd'], 0x30: ['cons', 'dh'], 0x31: ['cons', 'n'],
  0x33: ['cons', 'nd'], 0x34: ['cons', 'p'], 0x35: ['cons', 'ph'], 0x36: ['cons', 'b'],
  0x37: ['cons', 'bh'], 0x38: ['cons', 'm'], 0x39: ['cons', 'mb'], 0x3a: ['cons', 'y'],
  0x3b: ['cons', 'r'], 0x3d: ['cons', 'l'], 0x40: ['cons', 'v'], 0x41: ['cons', 'sh'],
  0x42: ['cons', 'sh'], 0x43: ['cons', 's'], 0x44: ['cons', 'h'], 0x45: ['cons', 'l'],
  0x46: ['cons', 'f'],
  0x4a: ['virama', ''],
  0x4f: ['sign', 'aa'], 0x50: ['sign', 'ae'], 0x51: ['sign', 'aae'], 0x52: ['sign', 'i'],
  0x53: ['sign', 'ee'], 0x54: ['sign', 'u'], 0x56: ['sign', 'oo'], 0x58: ['sign', 'ru'],
  0x59: ['sign', 'e'], 0x5a: ['sign', 'ee'], 0x5b: ['sign', 'ai'], 0x5c: ['sign', 'o'],
  0x5d: ['sign', 'oo'], 0x5e: ['sign', 'au'], 0x5f: ['sign', 'lu'], 0x72: ['sign', 'ruu'],
  0x73: ['sign', 'luu'],
  0x66: ['digit', '0'], 0x67: ['digit', '1'], 0x68: ['digit', '2'], 0x69: ['digit', '3'],
  0x6a: ['digit', '4'], 0x6b: ['digit', '5'], 0x6c: ['digit', '6'], 0x6d: ['digit', '7'],
  0x6e: ['digit', '8'], 0x6f: ['digit', '9'],
  0x74: ['punct', '.'],
}

const ZWJ = 0x200d
const ZWNJ = 0x200c

interface Resolved { script: ScriptId; off: number }

function resolve(cp: number): Resolved | null {
  for (const [script, base] of BLOCKS) {
    if (cp >= base && cp < base + 0x80) return { script, off: cp - base }
  }
  return null
}

/** Colloquial anusvara: "m" before a labial consonant (प/फ/ब/भ/म) or at the end of a word
 *  (no following consonant at all — the common Sanskrit-derived word-final case, e.g.
 *  मलयालम्/മലയാളം "Malayalam"); "n" before any other consonant (संगीत → sangeet). */
function colloquialAnusvara(nextChar: string | undefined): string {
  const next = resolve(nextChar?.codePointAt(0) ?? -1)
  const isConsonant = next !== null && next.off >= 0x15 && next.off <= 0x39
  const isLabial = next !== null && next.off >= 0x2a && next.off <= 0x2e
  return !isConsonant || isLabial ? 'm' : 'n'
}

function primarySubtag(tag: string): string {
  return tag.trim().toLowerCase().split(/[-_]/)[0] ?? ''
}

function languageFor(script: ScriptId, languages: string[]): string {
  for (const tag of languages) {
    const lang = primarySubtag(tag)
    if (LANG_SCRIPT[lang] === script) return lang
  }
  return DEFAULT_LANG[script]
}

/** Romanize a string. Non-Indic characters pass through unchanged. */
export function romanize(text: string, options: RomanizeOptions = {}): string {
  const variant = options.variant ?? 'strict'
  const strictMode = variant === 'strict'
  const dropSchwa = variant === 'readable' || variant === 'colloquial'
  const colloquial = variant === 'colloquial'

  const VOW = colloquial ? COLLOQUIAL_VOWELS : VOWELS
  const VSIGN = colloquial ? COLLOQUIAL_VOWEL_SIGNS : VOWEL_SIGNS
  const CONS = colloquial ? COLLOQUIAL_CONSONANTS : CONSONANTS
  const SCRIPT_CONS = colloquial ? COLLOQUIAL_SCRIPT_CONSONANTS : SCRIPT_CONSONANTS
  const PRE_NUKTA = colloquial ? COLLOQUIAL_PRECOMPOSED_NUKTA : PRECOMPOSED_NUKTA
  const NUKTA_TABLE = colloquial ? COLLOQUIAL_NUKTA : NUKTA
  const CHILLU_TABLE = colloquial ? COLLOQUIAL_CHILLU : CHILLU
  const SINHALA_TABLE = colloquial ? COLLOQUIAL_SINHALA : SINHALA

  const languages = options.languages ?? []
  const langCache = new Map<ScriptId, string>()
  const langOf = (s: ScriptId): string => {
    let l = langCache.get(s)
    if (l === undefined) { l = languageFor(s, languages); langCache.set(s, l) }
    return l
  }

  let out = ''
  // Pending consonant waiting to learn its vowel.
  let pending: { text: string; script: ScriptId; off: number; inCluster: boolean; carrier: boolean } | null = null
  let prevWasVirama = false     // last thing emitted was a consonant with virama
  let prevViramaCons = ''       // that consonant's transliteration (strict-mode 'h' check)
  let prevViramaOff = -1        // that consonant's offset (colloquial gemination check)
  let geminate = false          // Gurmukhi addak: double the next consonant
  let syllables = 0             // vowel nuclei so far in the current word
  let wordInitial = true        // true at the first Indic letter of a word (Tamil voicing)

  const vowelOut = (v: string, script: ScriptId): string => {
    if (variant === 'readable' && INDO_ARYAN.has(langOf(script))) {
      if (v === 'ē') return 'e'
      if (v === 'ō') return 'o'
    }
    return v
  }

  /** Emit an independent vowel (hiatus separator in strict mode). */
  const emitVowel = (v: string) => {
    if (strictMode && out.endsWith('a') && (v === 'i' || v === 'u') && syllables > 0) out += ':'
    out += v
    syllables++
  }

  /** Close the pending consonant. `boundary` = the word ends here. */
  const flush = (boundary: boolean) => {
    if (!pending) return
    const p = pending
    pending = null
    if (p.carrier) return // Gurmukhi vowel bearer with no vowel sign: nothing to write
    out += p.text
    const dropFinal = dropSchwa && boundary && syllables >= 1 && !p.inCluster &&
      FINAL_SCHWA_DROP.has(langOf(p.script))
    if (!dropFinal) {
      out += 'a'
      syllables++
    }
    prevWasVirama = false
  }

  const startConsonant = (text: string, script: ScriptId, off: number) => {
    flush(false)
    let t = text
    if (geminate) { t = t.charAt(0) + t; geminate = false }
    if (strictMode && prevWasVirama && t.startsWith('h') &&
        /^(k|g|c|j|ṭ|ḍ|t|d|p|b)$/.test(prevViramaCons)) {
      out += ':'
    }
    pending = { text: t, script, off, inCluster: prevWasVirama, carrier: false }
    prevWasVirama = false
  }

  const chars = Array.from(text.normalize('NFC'))
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]!
    const cp = ch.codePointAt(0)!

    if (cp === ZWJ || cp === ZWNJ) continue // shaping controls: no sound, stay in the run

    const r = resolve(cp)
    if (!r) {
      flush(true)
      syllables = 0
      prevWasVirama = false
      geminate = false
      wordInitial = true
      out += ch
      continue
    }
    const { script, off } = r
    const wasWordInitial = wordInitial
    wordInitial = false

    if (script === 'sinh') {
      const entry = SINHALA_TABLE[off]
      if (!entry) { flush(false); out += ch; continue }
      const [kind, t] = entry
      if (kind === 'cons') {
        startConsonant(t, script, off)
      } else if (kind === 'sign') {
        if (pending && !pending.carrier) { out += pending.text + t; pending = null; syllables++ }
        else emitVowel(t)
        prevWasVirama = false
      } else if (kind === 'virama') {
        if (pending && !pending.carrier) {
          out += pending.text
          prevViramaCons = pending.text
          prevViramaOff = pending.off
          prevWasVirama = true
          pending = null
        }
      } else if (kind === 'vowel') {
        flush(false)
        emitVowel(t)
        prevWasVirama = false
      } else if (kind === 'anusvara' || kind === 'visarga') {
        flush(false)
        out += t
      } else { // digit, punct
        flush(true)
        syllables = 0
        prevWasVirama = false
        wordInitial = true
        out += t
      }
      continue
    }

    // Tamil: வ/ல/ய-class letters go through the shared table below; க/ச/ட/ப and ற need
    // context (position, gemination) that a static table can't express.
    if (colloquial && script === 'taml') {
      const dyn = TAMIL_DYNAMIC[off]
      if (dyn) {
        const isGeminateSecond = prevWasVirama && prevViramaOff === off
        const text = isGeminateSecond || (dyn.hardAtWordInitial && wasWordInitial) ? dyn.hard : dyn.default
        startConsonant(text, script, off)
        continue
      }
      if (off === TAML_RRA_OFFSET) {
        startConsonant('tr', script, off) // bare form becomes "t" at virama time, below
        continue
      }
    }

    // Per-script specials first.
    const dead = script === 'mlym' ? CHILLU_TABLE[off] : DEAD_CONSONANTS[script]?.[off]
    if (dead !== undefined) {
      flush(false)
      out += dead
      prevWasVirama = false
      continue
    }
    if (script === 'deva' && off === 0x72) { // ॲ (Marathi, English loanwords)
      flush(false)
      emitVowel(colloquial ? 'e' : 'ê')
      continue
    }
    if (script === 'mlym' && off === 0x4e) { // dot reph: r before the next consonant
      flush(false)
      out += 'r'
      prevWasVirama = true
      prevViramaCons = 'r'
      prevViramaOff = off
      continue
    }
    if (script === 'beng' && off === 0x4e) { // khanda ta: final t
      flush(false)
      out += 't'
      prevWasVirama = false
      continue
    }
    if (script === 'taml' && off === 0x03) { // āytam
      flush(false)
      out += colloquial ? 'k' : 'ḵ'
      continue
    }
    if (script === 'guru') {
      if (off === 0x70) { flush(false); out += colloquial ? colloquialAnusvara(chars[i + 1]) : 'ṁ'; continue }  // tippi
      if (off === 0x71) { flush(false); geminate = true; continue }                 // addak
      if (off === 0x72 || off === 0x73) {                                            // vowel bearers ੲ ੳ
        flush(false)
        pending = { text: '', script, off, inCluster: false, carrier: true }
        continue
      }
      if (off === 0x75) {                                                            // yakash (subjoined ya)
        if (pending && !pending.carrier) { out += pending.text; pending = null }
        startConsonant('y', script, off)
        continue
      }
    }

    const cons = SCRIPT_CONS[script]?.[off] ?? CONS[off] ??
      (HAS_PRECOMPOSED_NUKTA.has(script) ? PRE_NUKTA[off] : undefined)
    if (cons !== undefined) { startConsonant(cons, script, off); continue }

    if (off === 0x3c) { // nukta
      if (pending && !pending.carrier) {
        const n = NUKTA_TABLE[pending.off]
        if (n !== undefined) pending.text = n
      }
      continue
    }

    const sign = VSIGN[off]
    if (sign !== undefined) {
      const v = vowelOut(sign, script)
      if (pending) {
        const p = pending
        pending = null
        if (p.carrier) emitVowel(v)
        else { out += p.text + v; syllables++ }
      } else {
        emitVowel(v)
      }
      prevWasVirama = false
      continue
    }

    if (off === 0x4d) { // virama
      if (pending && !pending.carrier) {
        if (colloquial && pending.script === 'taml') {
          const dyn = TAMIL_DYNAMIC[pending.off]
          if (dyn) pending.text = dyn.hard
          else if (pending.off === TAML_RRA_OFFSET) pending.text = 't'
        }
        out += pending.text
        prevViramaCons = pending.text
        prevViramaOff = pending.off
        prevWasVirama = true
        pending = null
      }
      continue
    }

    const vowel = VOW[off]
    if (vowel !== undefined) {
      flush(false)
      emitVowel(vowelOut(vowel, script))
      prevWasVirama = false
      continue
    }

    if (off === 0x00 || off === 0x01) { flush(false); out += colloquial ? 'n' : 'm̐'; continue } // candrabindu
    if (off === 0x02) { // anusvara
      flush(false)
      out += colloquial ? colloquialAnusvara(chars[i + 1]) : 'ṁ'
      continue
    }
    if (off === 0x03) { flush(false); out += colloquial ? 'h' : 'ḥ'; continue }                   // visarga
    if (off === 0x3d) { if (!colloquial) { flush(false); out += 'ʼ' } continue }                  // avagraha: dropped colloquially
    if (off === 0x50) { // om
      flush(false)
      out += colloquial ? 'om' : vowelOut('ō', script) + 'm̐'
      syllables++
      continue
    }

    // Word-level punctuation and digits end the word.
    if (off === 0x64 || off === 0x65 || (off >= 0x66 && off <= 0x6f) || off === 0x70) {
      flush(true)
      syllables = 0
      prevWasVirama = false
      wordInitial = true
      if (off === 0x64) out += '.'
      else if (off === 0x65) out += '..'
      else if (off === 0x70) out += '.' // Devanagari abbreviation sign
      else out += String(off - 0x66)
      continue
    }

    // Length marks and other signs without a sound of their own.
    if (off === 0x55 || (off >= 0x51 && off <= 0x54)) continue

    // Anything unmapped (rare letters, fractions, symbols) passes through as-is.
    flush(false)
    out += ch
  }
  flush(true)
  return out
}

// ── Sutra-level romanization ───────────────────────────────────────────────────

export type RomanizeScope = 'all' | 'dialogue'

export interface RomanizeSutraOptions {
  /** 'all' (default): every line. 'dialogue': only dialogue blocks (cue, parentheticals,
   *  dialogue) and lyrics; headings, action, metadata, and the title page stay native. */
  scope?: RomanizeScope
  /** Default 'strict'. Character names always use the readable form of the chosen
   *  variant (see below). */
  variant?: RomanizeVariant
  /** Overrides the document's own frontmatter `lang` + `lang-secondary`. */
  languages?: string[]
  /** Insert a centered notice at the top of the body stating the scheme and variant.
   *  Default true. */
  notice?: boolean
}

const INDIC_RE = /[ऀ-෿]/
const INDIC_WORD_CHAR_RE = /[ऀ-෿‌‍]/

/** Languages declared in frontmatter: `lang` first, then `lang-secondary` (a string, a
 *  comma list, or a `[a, b]` flow list, which the minimal YAML parser keeps as a string). */
export function documentLanguages(data: Record<string, unknown> | undefined): string[] {
  if (!data) return []
  const out: string[] = []
  const push = (v: unknown) => {
    if (Array.isArray(v)) { v.forEach(push); return }
    if (typeof v !== 'string') return
    for (const part of v.replace(/^\s*\[|\]\s*$/g, '').split(',')) {
      const t = part.trim().replace(/^['"]|['"]$/g, '')
      if (t) out.push(t)
    }
  }
  push(data['lang'])
  push(data['lang-secondary'])
  return out
}

function titleCase(s: string): string {
  return s.replace(/(^|[\s\-'])(\p{Ll})/gu, (_m, pre: string, c: string) => pre + c.toUpperCase())
}

/** Cue name: text after '@' up to an extension '(', dual marker '^', or attribute '{'. */
function cueName(line: string): string {
  return line.replace(/^@/, '').split(/[({^]/)[0]!.trim()
}

/** The readable form of a given export variant, used for character names (§5.8.1 rule 7):
 *  strict/readable export → readable ISO 15919; colloquial export → colloquial. */
function nameVariant(variant: RomanizeVariant): RomanizeVariant {
  return variant === 'colloquial' ? 'colloquial' : 'readable'
}

/**
 * Romanize a whole Sutra source for export. The result is still valid Sutra (sigils,
 * IDs, keys, and markup are Latin and pass through), so callers parse it and hand the AST
 * to the normal exporters.
 *
 * Character names follow the primary language's convention in every variant: names from
 * cues (including the character registry) are romanized with the readable form of the
 * chosen variant and title-cased (विक्रम → Vikram), and every exact occurrence of such a
 * name in romanized text uses the same spelling.
 */
export function romanizeSutra(source: string, options: RomanizeSutraOptions = {}): string {
  const scope = options.scope ?? 'all'
  const variant = options.variant ?? 'strict'
  const eol = source.includes('\r\n') ? '\r\n' : '\n'
  const lines = source.split(/\r?\n/)

  // Frontmatter extent and languages.
  let bodyStart = 0
  const fmData: Record<string, unknown> = {}
  if (lines[0] === '---') {
    const close = lines.indexOf('---', 1)
    if (close > 0) {
      bodyStart = close + 1
      for (const l of lines.slice(1, close)) {
        const m = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(l)
        if (m) fmData[m[1]!] = m[2]!.trim()
      }
    }
  }
  const languages = options.languages ?? documentLanguages(fmData)

  // Character names → their romanized spelling (longest first for matching).
  const names = new Map<string, string>()
  for (const l of lines.slice(bodyStart)) {
    if (!l.startsWith('@')) continue
    const name = cueName(l)
    if (name && INDIC_RE.test(name) && !names.has(name)) {
      names.set(name, titleCase(romanize(name, { variant: nameVariant(variant), languages })))
    }
  }
  const nameList = [...names.keys()].sort((a, b) => b.length - a.length)

  const romanizeLine = (line: string): string => {
    if (!INDIC_RE.test(line)) return line
    let result = ''
    let rest = line
    // Replace whole-word occurrences of character names, romanize the text between.
    outer: while (rest.length > 0) {
      for (let i = 0; i < rest.length; i++) {
        for (const name of nameList) {
          if (!rest.startsWith(name, i)) continue
          const before = i > 0 ? rest[i - 1]! : ''
          const after = rest[i + name.length] ?? ''
          if (INDIC_WORD_CHAR_RE.test(before) || INDIC_WORD_CHAR_RE.test(after)) continue
          result += romanize(rest.slice(0, i), { variant, languages }) + names.get(name)!
          rest = rest.slice(i + name.length)
          continue outer
        }
      }
      result += romanize(rest, { variant, languages })
      break
    }
    return result
  }

  const out: string[] = []
  // Frontmatter: title-page values are romanized only in 'all' scope.
  for (let i = 0; i < bodyStart; i++) {
    const l = lines[i]!
    out.push(scope === 'all' ? romanizeLine(l) : l)
  }

  if (options.notice !== false) {
    const label = variant === 'colloquial' ? 'casual' : variant === 'readable' ? 'readable, ISO 15919' : 'ISO 15919'
    out.push('', `>> ROMANIZED COPY · ${label} <<`, '')
  }

  // Body: in 'dialogue' scope, classify by block (blank-line separated) like the parser.
  let blockKind: 'dialogue' | 'other' = 'other'
  let atBlockStart = true
  let inRegistry = false
  for (let i = bodyStart; i < lines.length; i++) {
    const l = lines[i]!
    if (l.trim() === '') {
      atBlockStart = true
      out.push(l)
      continue
    }
    if (atBlockStart) {
      atBlockStart = false
      if (/^#(\s|$)/.test(l)) inRegistry = /\{#characters\}\s*$/.test(l) || /^#\s+Characters\s*$/i.test(l)
      else if (/^##(\s|$)/.test(l)) inRegistry = false
      blockKind = !inRegistry && (l.startsWith('@') || /^~\s/.test(l)) ? 'dialogue' : 'other'
    }
    out.push(scope === 'all' || blockKind === 'dialogue' ? romanizeLine(l) : l)
  }
  return out.join(eol)
}
