import { createContext, useContext } from 'react'

/**
 * Who is using the editor and what they may do (OSS spec §11.5). Optional:
 * without one, the editor behaves as a single local user with full edit
 * rights and no feature flags.
 *
 * - `edit`: everything.
 * - `read`: the document cannot be changed. The formatted and source editors
 *   are read-only; save/open/import, AI, voice, the element toolbar, and
 *   structural navigator actions (reorder, synopsis edits, scene-number
 *   locking) are unavailable.
 * - `comment`: like `read`; decoration providers (comment threads) may still
 *   handle clicks.
 *
 * `featureFlags`: `ai: false` hides AI features, `voice: false` hides voice
 * dictation. Unset flags count as enabled.
 */
export interface SessionContext {
  userId: string | null
  displayName: string | null
  permission: 'read' | 'comment' | 'edit'
  featureFlags: Record<string, boolean>
}

export const DEFAULT_SESSION: SessionContext = {
  userId: null,
  displayName: null,
  permission: 'edit',
  featureFlags: {},
}

const SessionReactContext = createContext<SessionContext>(DEFAULT_SESSION)

export const SessionProvider = SessionReactContext.Provider

export function useSession(): SessionContext {
  return useContext(SessionReactContext)
}

/** True when the current session may change the document. */
export function useCanEdit(): boolean {
  return useSession().permission === 'edit'
}

/** A feature is on unless the session's featureFlags turn it off explicitly. */
export function isFeatureEnabled(session: SessionContext, flag: string): boolean {
  return session.featureFlags[flag] !== false
}
