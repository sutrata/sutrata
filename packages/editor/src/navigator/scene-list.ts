import { splitAttributeBlock } from '@sutrata/parser'

export interface SceneEntry {
  id: string | null
  /** `& number:` — the production scene number (format spec §7.4), if set. */
  number: string | null
  heading: string
  synopsis: string
  status: string
  tags: string[]
  location: string
  index: number       // 1-based position (internal, used for PM navigation)
  textOffset: number  // character offset in source text where this scene starts
  estDuration?: string
}

/**
 * Derive a flat scene list from Sutra source text.
 * Scenes are identified by scene heading lines (## prefix).
 */
export function buildSceneList(text: string): SceneEntry[] {
  const lines = text.split('\n')
  const scenes: SceneEntry[] = []
  let sceneIndex = 0
  let currentOffset = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''
    const trimmed = line.trim()

    // Scene headings start with ## (Sutra sigil)
    if (trimmed.startsWith('## ') || trimmed.startsWith('##\t')) {
      const headingRaw = trimmed.slice(3).trim()
      const sceneStart = currentOffset

      // Split the trailing attribute block ({#id lang=…}, §10) off the heading
      const { body, id: sceneId } = splitAttributeBlock(headingRaw)
      const heading = body.trim()

      // Collect metadata (& key: value) until next heading
      let synopsis = ''
      let status = ''
      let tags: string[] = []
      let location = ''
      let estDuration = ''
      let number: string | null = null

      let j = i + 1
      while (j < lines.length) {
        const nextLine = (lines[j] ?? '').trim()
        if (nextLine.startsWith('## ') || nextLine.startsWith('##\t')) break
        if (nextLine.startsWith('& synopsis:')) {
          if (!synopsis) synopsis = nextLine.replace('& synopsis:', '').trim()
        } else if (nextLine.startsWith('& status:')) {
          status = nextLine.replace('& status:', '').trim()
        } else if (nextLine.startsWith('& tags:')) {
          tags = nextLine
            .replace('& tags:', '')
            .trim()
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
        } else if (nextLine.startsWith('& location:')) {
          location = nextLine.replace('& location:', '').trim()
        } else if (nextLine.startsWith('& number:')) {
          number = nextLine.replace('& number:', '').trim() || null
        } else if (nextLine.startsWith('& est-duration:')) {
          estDuration = nextLine.replace('& est-duration:', '').trim()
        }
        j++
      }

      scenes.push({
        id: sceneId,
        number,
        heading,
        synopsis,
        status,
        tags,
        location,
        estDuration: estDuration || undefined,
        index: ++sceneIndex,
        textOffset: sceneStart,
      })
    }

    currentOffset += (line?.length ?? 0) + 1 // +1 for \n
  }

  return scenes
}
