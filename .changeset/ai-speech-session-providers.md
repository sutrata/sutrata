---
"@sutrata/editor": minor
---

`AIProvider`, `SpeechProvider`, `SessionContext` and a `PanelRegistry` (settings location) are now real extension points, injected through new optional `DocumentProvider` props: `aiProvider`, `speechProvider`, `session`, `panels`.

- AI features (synopsis/duration generation, AI formatting of selections and dictation, status-bar activity) go through `useAI()` and are hidden when no provider is injected, the session cannot edit, or `featureFlags.ai` is false. Voice dictation needs both providers and `featureFlags.voice !== false`.
- `session.permission` `read`/`comment` makes the formatted and source editors read-only (doc-changing transactions are dropped) and hides save/open/import, the element toolbar, title-page and style editing, replace, and structural navigator actions.
- The Settings dialog renders embedder sections registered for the `settings` location.
- The bring-your-own-key AI client, API-key storage, provider catalog, AI settings UI and onboarding dialog moved to `@sutrata/app`.

### Migration

- `useDocument()` no longer has `aiOnboardingVisible` / `setAIOnboardingVisible`. Call `aiProvider.openSetup?.()` instead; the embedder owns its setup UI.
- AI and voice are **off** unless you pass `aiProvider` (and `speechProvider` for dictation). The OSS app's implementations are `createByoKeyAIProvider` / `createWebSpeechProvider` in `packages/app/src/ai/byo-key-providers.ts`.
- The `AIProvider` type changed shape: `complete(req: { system?, prompt, signal? })`, plus `isConfigured()` and `completeStructured()`; optional `subscribeActivity()` and `openSetup()`. `SpeechProvider` gains `isSupported()` and `listen()`; `transcribe()` is optional.
- `PanelRegistry` changed from `registerPanel()` to `register()` returning an unregister function; build one with `createPanelRegistry()`.
