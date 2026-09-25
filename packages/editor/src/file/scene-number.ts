import type { SceneHeadingNode } from '@sutrata/parser'

/** The printed scene number: the `{#id}` (format spec §6.1, §7.4). */
export function sceneNumberOf(node: SceneHeadingNode): string | null {
  return node.id || null
}

/** `& status: omitted` (format spec §7.4). */
export function isOmitted(node: SceneHeadingNode): boolean {
  return node.metadata.some(m => m.key === 'status' && m.value.trim().toLowerCase() === 'omitted')
}
