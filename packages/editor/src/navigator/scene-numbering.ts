/**
 * Scene numbers (Sutra format spec §7.4). `& number:` holds a scene's
 * production number: digits plus an optional letter suffix (`12`, `12A`).
 * Numbers change only when the writer asks to renumber; until then they may
 * be missing, duplicated or out of order, and the navigator flags them.
 */

export interface SceneNumber {
  base: number
  /** Uppercase letters, '' for a plain number. */
  suffix: string
}

export type SceneNumberIssue = 'missing' | 'invalid' | 'duplicate' | 'order'

export function parseSceneNumber(value: string | null | undefined): SceneNumber | null {
  const m = /^(\d+)([A-Za-z]*)$/.exec((value ?? '').trim())
  return m ? { base: Number(m[1]), suffix: m[2]!.toUpperCase() } : null
}

export function formatSceneNumber(n: SceneNumber): string {
  return `${n.base}${n.suffix}`
}

/** Letter suffixes in order: '' < A < … < Z < AA < AB … */
function compareSuffix(a: string, b: string): number {
  return a.length !== b.length ? a.length - b.length : a < b ? -1 : a > b ? 1 : 0
}

export function compareSceneNumbers(a: SceneNumber, b: SceneNumber): number {
  return a.base !== b.base ? a.base - b.base : compareSuffix(a.suffix, b.suffix)
}

/** '' → A, A → B, Z → AA, AZ → BA. */
export function nextLetter(suffix: string): string {
  const letters = suffix.split('')
  let i = letters.length - 1
  while (i >= 0 && letters[i] === 'Z') letters[i--] = 'A'
  if (i < 0) return 'A' + letters.join('')
  letters[i] = String.fromCharCode(letters[i]!.charCodeAt(0) + 1)
  return letters.join('')
}

function shiftLetters(suffix: string, by: number): string {
  let s = suffix
  for (let i = 0; i < by; i++) s = nextLetter(s)
  return s
}

/**
 * Per scene: why its number needs renumbering, or null when it is fine.
 * Nothing is flagged while no scene has a number (the script was never
 * numbered). A repeat or a number that doesn't come after the previous good
 * one is flagged on the later scene.
 */
export function sceneNumberIssues(numbers: readonly (string | null | undefined)[]): (SceneNumberIssue | null)[] {
  if (!numbers.some(n => n && n.trim())) return numbers.map(() => null)
  const seen = new Set<string>()
  let last: SceneNumber | null = null
  return numbers.map(value => {
    if (!value || !value.trim()) return 'missing'
    const n = parseSceneNumber(value)
    if (!n) return 'invalid'
    const key = formatSceneNumber(n)
    if (seen.has(key)) return 'duplicate'
    if (last && compareSceneNumbers(n, last) <= 0) return 'order'
    seen.add(key)
    last = n
    return null
  })
}

/**
 * New numbers for every scene, per §7.4. Scenes whose number is fine keep
 * their place in the sequence; every flagged scene (and, in a never-numbered
 * script, every scene) counts as inserted at its position:
 * - if the next good scene continues the previous scene's lettered run, it
 *   takes the next letter and the rest of that run shifts one letter
 *   (20A, new, 20B → 20A, 20B, 20C);
 * - otherwise it takes the next number and every later number goes up by
 *   one, keeping its letter (12, new, 13 → 12, 13, 14; 20, 20A, 21 → 21, 21A, 22).
 */
export function renumberScenes(numbers: readonly (string | null | undefined)[]): string[] {
  const issues = sceneNumberIssues(numbers)
  const inserted = numbers.map((n, i) => issues[i] !== null || !n || !n.trim())
  const good = numbers.map((n, i) => (inserted[i] ? null : parseSceneNumber(n)))

  const out: SceneNumber[] = []
  let shift = 0                        // added to every later good base
  let letterShift = 0                  // added to later suffixes in the current run
  let runBase: number | null = null    // original base of the current lettered run
  let prev: SceneNumber | null = null  // previous output number

  for (let i = 0; i < numbers.length; i++) {
    const own = good[i]
    if (own) {
      if (own.base !== runBase) { runBase = own.base; letterShift = 0 }
      prev = { base: own.base + shift, suffix: own.suffix ? shiftLetters(own.suffix, letterShift) : '' }
      out.push(prev)
      continue
    }
    const next = good.slice(i + 1).find((n): n is SceneNumber => n !== null) ?? null
    if (prev && next && runBase === next.base && next.suffix !== '') {
      prev = { base: prev.base, suffix: nextLetter(prev.suffix) }
      letterShift++
    } else {
      const base: number = prev ? prev.base + 1 : next ? next.base + shift : 1
      shift += 1
      prev = { base, suffix: '' }
      runBase = null
      letterShift = 0
    }
    out.push(prev)
  }
  return out.map(formatSceneNumber)
}
