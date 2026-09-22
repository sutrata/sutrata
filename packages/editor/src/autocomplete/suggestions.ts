export interface Candidate {
  label: string
  type: 'character' | 'location' | 'transition' | 'metadata_key'
}

const PREDEFINED_TRANSITIONS = [
  'CUT TO:', 'FADE IN:', 'FADE OUT:', 'DISSOLVE TO:', 'SMASH CUT TO:',
  'MATCH CUT TO:', 'WIPE TO:', 'IRIS IN:', 'IRIS OUT:',
]

const RESERVED_METADATA_KEYS = [
  'status', 'tags', 'location', 'time', 'number', 'lang', 'mood',
  'arc', 'note', 'locked',
]

/**
 * Extract character candidates from screenplay text.
 * Sources: @CHARACTER cues in the text and {#characters} registry blocks.
 */
export function buildCharacterCandidates(text: string): Candidate[] {
  const seen = new Set<string>()
  const candidates: Candidate[] = []

  // Scan for @CHARACTER lines (character block sigil)
  const lines = text.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('@')) {
      const name = trimmed.slice(1).trim().toUpperCase()
      if (name && !seen.has(name)) {
        seen.add(name)
        candidates.push({ label: name, type: 'character' })
      }
    }
  }

  // Also scan for names in {#characters} registry blocks
  const charRegistryRegex = /\{#characters\}([\s\S]*?)\{\/characters\}/g
  let match
  while ((match = charRegistryRegex.exec(text)) !== null) {
    const block = match[1]
    if (block) {
      for (const line of block.split('\n')) {
        const name = line.trim().toUpperCase()
        if (name && !seen.has(name)) {
          seen.add(name)
          candidates.push({ label: name, type: 'character' })
        }
      }
    }
  }

  return candidates.sort((a, b) => a.label.localeCompare(b.label))
}

/**
 * Extract location candidates from scene headings and & location: metadata.
 */
export function buildLocationCandidates(text: string): Candidate[] {
  const seen = new Set<string>()
  const candidates: Candidate[] = []

  const lines = text.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()

    // Scene headings: ## INT. LIVING ROOM - DAY → location = "INT. LIVING ROOM"
    if (trimmed.startsWith('## ')) {
      const heading = trimmed.slice(3).trim()
      // Extract location part (before the dash)
      const dashIdx = heading.indexOf(' - ')
      const loc = dashIdx >= 0 ? heading.slice(0, dashIdx).trim() : heading
      if (loc && !seen.has(loc)) {
        seen.add(loc)
        candidates.push({ label: loc, type: 'location' })
      }
    }

    // & location: metadata
    if (trimmed.startsWith('& location:')) {
      const loc = trimmed.replace('& location:', '').trim()
      if (loc && !seen.has(loc)) {
        seen.add(loc)
        candidates.push({ label: loc, type: 'location' })
      }
    }
  }

  return candidates.sort((a, b) => a.label.localeCompare(b.label))
}

/**
 * Build transition candidates: predefined + used in text.
 */
export function buildTransitionCandidates(text: string): Candidate[] {
  const seen = new Set<string>(PREDEFINED_TRANSITIONS)
  const candidates: Candidate[] = PREDEFINED_TRANSITIONS.map(t => ({ label: t, type: 'transition' as const }))

  const lines = text.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    // Transition lines start with >>
    if (trimmed.startsWith('>> ')) {
      const trans = trimmed.slice(3).trim()
      if (trans && !seen.has(trans)) {
        seen.add(trans)
        candidates.push({ label: trans, type: 'transition' })
      }
    }
  }

  return candidates
}

/**
 * Build metadata key candidates: reserved + used in text.
 */
export function buildMetadataKeyCandidates(text: string): Candidate[] {
  const seen = new Set<string>(RESERVED_METADATA_KEYS)
  const candidates: Candidate[] = RESERVED_METADATA_KEYS.map(k => ({ label: k, type: 'metadata_key' as const }))

  const lines = text.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('& ')) {
      const keyMatch = /^& ([a-zA-Z_]+):/.exec(trimmed)
      if (keyMatch) {
        const key = keyMatch[1]
        if (key && !seen.has(key)) {
          seen.add(key)
          candidates.push({ label: key, type: 'metadata_key' })
        }
      }
    }
  }

  return candidates
}

/**
 * Filter candidates by prefix (case-insensitive).
 */
export function filterCandidates(candidates: Candidate[], prefix: string): Candidate[] {
  if (!prefix) return candidates
  const lower = prefix.toLowerCase()
  return candidates.filter(c => c.label.toLowerCase().startsWith(lower))
}
