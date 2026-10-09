export interface Token { word: string; start: number; end: number }

/**
 * Words in `text` with their character offsets. Letters and combining marks in
 * any script, plus joiners (which Indic scripts use inside words), apostrophes
 * and hyphens between letters.
 */
export function tokenizeWords(text: string): Token[] {
  const results: Token[] = []
  const regex = /[\p{L}\p{M}‌‍]+(?:['’-][\p{L}\p{M}‌‍]+)*/gu
  let match
  while ((match = regex.exec(text)) !== null) {
    results.push({ word: match[0], start: match.index, end: match.index + match[0].length })
  }
  return results
}

/** The form a dictionary expects: typographic apostrophes straightened. */
export function normalizeWord(word: string): string {
  return word.replace(/’/g, "'")
}

/** Acronyms and shouted words are not checked: screenplays capitalise for emphasis. */
export function isShouted(word: string): boolean {
  return word.length > 1 && word === word.toUpperCase() && word !== word.toLowerCase()
}
