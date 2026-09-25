/**
 * Scene numbers (Sutra format spec §7.4). A scene's `{#id}` is its number:
 * digits plus an optional letter suffix (`12`, `12A`). Numbers change only
 * when the writer asks to renumber; until then they may be missing,
 * duplicated or out of order, and the navigator flags them.
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

/**
 * Per scene: why its number needs renumbering, or null when it is fine.
 * Nothing is flagged while no scene has a number (the script was never
 * numbered). A repeat or a number that doesn't come after the previous good
 * one is flagged on the later scene.
 */
export function sceneNumberIssues(numbers: readonly (string | null | undefined)[]): (SceneNumberIssue | null)[] {
  if (!numbers.some(n => parseSceneNumber(n))) return numbers.map(() => null)
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
 * New numbers for every scene, per §7.4. Position decides everything; a
 * scene's old number only says whether it is a main scene (`12`) or a
 * sub-scene (`12A`) of the main scene before it, so repeats and gaps need
 * no special handling:
 * - main scenes are numbered 1, 2, 3, … in order, closing any gaps;
 * - sub-scenes take their main scene's number and the next letter (A, B, …);
 * - a scene with no usable number is inserted: it is a sub-scene when the
 *   next scene with a number is one (2A, new, 2B → 2A, 2B, 2C), otherwise
 *   a main scene;
 * - a sub-scene with no main scene before it becomes a main scene.
 */
export function renumberScenes(numbers: readonly (string | null | undefined)[]): string[] {
  const own = numbers.map(parseSceneNumber)

  const out: string[] = []
  let base = 0
  let suffix = ''
  for (let i = 0; i < numbers.length; i++) {
    const ref = own[i] ?? own.slice(i + 1).find((n): n is SceneNumber => n !== null) ?? null
    if (ref && ref.suffix && base > 0) {
      suffix = nextLetter(suffix)
    } else {
      base++
      suffix = ''
    }
    out.push(formatSceneNumber({ base, suffix }))
  }
  return out
}
