export type EditorMode = 'formatted' | 'source'

export interface VersionEntry {
  id: string
  timestamp: number
  content: string
}
