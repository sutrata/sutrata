/**
 * @sutrata/extension-testkit — a stub embedder (OSS spec §11.1, §11.5).
 *
 * In-memory implementations of every @sutrata/editor extension point, built
 * only on the editor's public entry point. They double as reference
 * implementations for embedders and as fixtures for the contract tests in
 * ../tests, which CI runs against the built editor on every PR.
 */
import type {
  StorageAdapter, VersionEntry, ScreenplayStyleDefinition,
  AIProvider, AIActivity, AIRequest, JsonSchema,
  SpeechProvider, SpeechRecognitionCallbacks,
  SessionContext,
  DecorationProvider, DecorationSpec, DecorationContext,
  CollabBinding,
} from '@sutrata/editor'
import type { Plugin } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'

// ── StorageAdapter ───────────────────────────────────────────────────────────

export interface MemoryStorage extends StorageAdapter {
  /** Documents by path (saveDocument / autosave). */
  documents: Map<string, string>
  /** Files written through saveFile, by name. */
  files: Map<string, string>
  /** What openFile() returns next. */
  nextOpen: { name: string; content: string } | null
}

export function createMemoryStorage(): MemoryStorage {
  const documents = new Map<string, string>()
  const files = new Map<string, string>()
  const versions = new Map<string, VersionEntry[]>()
  const styles = new Map<string, ScreenplayStyleDefinition>()
  const storage: MemoryStorage = {
    documents, files, nextOpen: null,
    async saveDocument(path, content) { documents.set(path, content) },
    async loadDocument(path) { return documents.get(path) ?? null },
    async listVersions(path) { return versions.get(path) ?? [] },
    async openFile() {
      const next = storage.nextOpen
      storage.nextOpen = null
      return next ? { ...next, handle: next.name } : null
    },
    async openDocx() { return null },
    async openStyleJson() { return null },
    async saveFile(name, content) {
      files.set(name, content)
      return { savedName: name, handle: name }
    },
    async saveStyle(style) { styles.set(style.id, style) },
    async loadAllStyles() { return [...styles.values()] },
    async deleteStyle(id) { styles.delete(id) },
    async saveVersion(path, content) {
      const list = versions.get(path) ?? []
      if (list.at(-1)?.content === content) return false
      const entry: VersionEntry = { id: String(list.length + 1), timestamp: Date.now(), content }
      versions.set(path, [...list, entry])
      return true
    },
  }
  return storage
}

// ── AIProvider ───────────────────────────────────────────────────────────────

export interface StubAI extends AIProvider {
  /** Every request, in order. */
  calls: Array<AIRequest & { schema?: JsonSchema }>
  /** Answers to complete(); default: echoes the prompt. */
  reply: (req: AIRequest) => string
  /** Answers to completeStructured(); default: a synopsis/duration pair. */
  replyStructured: (req: AIRequest & { schema: JsonSchema }) => unknown
  configured: boolean
  setupOpened: number
  /** Pushes an activity list to subscribers (status bar). */
  setActivity(calls: AIActivity[]): void
}

export function createStubAI(): StubAI {
  const listeners = new Set<(calls: AIActivity[]) => void>()
  let activity: AIActivity[] = []
  const ai: StubAI = {
    id: 'stub-ai',
    displayName: 'Stub AI',
    dataPolicyText: 'Test stub: requests never leave the process.',
    calls: [],
    reply: req => req.prompt,
    replyStructured: () => ({ synopsis: 'Stub synopsis.', duration: '01:00' }),
    configured: true,
    setupOpened: 0,
    isConfigured: () => ai.configured,
    async complete(req) {
      ai.calls.push(req)
      return ai.reply(req)
    },
    async completeStructured<T>(req: AIRequest & { schema: JsonSchema }) {
      ai.calls.push(req)
      return ai.replyStructured(req) as T
    },
    subscribeActivity(cb) {
      listeners.add(cb)
      cb(activity)
      return () => { listeners.delete(cb) }
    },
    openSetup() { ai.setupOpened++ },
    setActivity(next) {
      activity = next
      for (const l of listeners) l(activity)
    },
  }
  return ai
}

// ── SpeechProvider ───────────────────────────────────────────────────────────

export interface StubSpeech extends SpeechProvider {
  /** Callbacks of the running recognition, if any. */
  active: SpeechRecognitionCallbacks | null
  /** Deliver a recognition result to the running session. */
  say(text: string, isFinal?: boolean): void
}

export function createStubSpeech(): StubSpeech {
  const speech: StubSpeech = {
    id: 'stub-speech',
    displayName: 'Stub Speech',
    active: null,
    isSupported: () => true,
    listen(_language, callbacks) {
      speech.active = callbacks
      const end = () => { speech.active = null; callbacks.onEnd() }
      return { stop: end, abort: end }
    },
    say(text, isFinal = true) { speech.active?.onResult(text, isFinal) },
  }
  return speech
}

// ── SessionContext ───────────────────────────────────────────────────────────

export function createSession(
  permission: SessionContext['permission'] = 'edit',
  featureFlags: Record<string, boolean> = {},
): SessionContext {
  return { userId: `stub-${permission}`, displayName: `Stub ${permission}`, permission, featureFlags }
}

// ── DecorationProvider ───────────────────────────────────────────────────────

export interface StubDecorations extends DecorationProvider {
  /** Replace the decorations and notify the editor. */
  set(specs: DecorationSpec[] | ((ctx: DecorationContext) => DecorationSpec[])): void
}

export function createStubDecorations(id = 'stub-decorations'): StubDecorations {
  const listeners = new Set<() => void>()
  let source: (ctx: DecorationContext) => DecorationSpec[] = () => []
  return {
    id,
    subscribe(cb) {
      listeners.add(cb)
      return () => { listeners.delete(cb) }
    },
    getDecorations: ctx => source(ctx),
    set(specs) {
      source = typeof specs === 'function' ? specs : () => specs
      for (const l of listeners) l()
    },
  }
}

// ── CollabBinding ────────────────────────────────────────────────────────────

export interface StubCollab extends CollabBinding {
  /** The view passed to attach(), until detached. */
  view: EditorView | null
  attached: number
  detached: number
}

/** A collab binding that installs the given plugins and records attach/detach. */
export function createStubCollab(makePlugins: () => Plugin[] = () => []): StubCollab {
  const collab: StubCollab = {
    view: null,
    attached: 0,
    detached: 0,
    plugins: () => makePlugins(),
    attach(view) {
      collab.view = view
      collab.attached++
      return () => { collab.view = null; collab.detached++ }
    },
  }
  return collab
}
