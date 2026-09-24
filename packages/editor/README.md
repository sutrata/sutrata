# @sutrata/editor

The React screenplay editor behind [Sutrata](https://github.com/sutrata/sutrata), for writing scripts in **Sutra**, a plain-text screenplay format for world languages. It's built on ProseMirror and handles Indic and other complex scripts properly:
- Text is stored in logical order.
- The cursor and selection move by grapheme cluster (user-perceived character).
- Find/replace matches after NFC normalization, so differently encoded forms of the same text still match.

This package contains the complete editor:
- WYSIWYG and source modes, with smart Enter that cycles through screenplay elements.
- A scene navigator, find/replace, a title-page form and screenplay styles.
- Statistics, autocomplete and spellcheck.
- Export to PDF, DOCX, Fountain and workflow reports, including romanized exports.
- Localized UI.

Sutra parsing and serialization come from [`@sutrata/parser`](https://www.npmjs.com/package/@sutrata/parser).

## Install

```bash
npm install @sutrata/editor react react-dom
```

`react` and `react-dom` (^18.3) are peer dependencies.

## Usage

The editor doesn't read or write files itself. You pass it a `StorageAdapter`, and it saves, opens and keeps version history through that adapter. The same editor can therefore run on local files, in a desktop shell or against a server.

```tsx
import React from 'react'
import { createRoot } from 'react-dom/client'
import {
  TranslationProvider,
  LanguageProvider,
  DocumentProvider,
  AppShell,
  type StorageAdapter,
} from '@sutrata/editor'
import '@sutrata/editor/dist/shell/fonts/fonts.css'
import '@sutrata/editor/dist/styles/screenplay.css'

const storageAdapter: StorageAdapter = {
  // documents and version history
  saveDocument: async (path, content) => { /* ... */ },
  loadDocument: async (path) => null,
  listVersions: async (path) => [],
  // file dialogs
  openFile: async () => null,        // { name, content, handle }
  openDocx: async () => null,        // { name, buffer }
  openStyleJson: async () => null,   // { name, text }
  saveFile: async (name, content, handle) => null, // { savedName, handle }
  // custom screenplay styles
  saveStyle: async (style) => {},
  loadAllStyles: async () => [],
  deleteStyle: async (id) => {},
}

createRoot(document.getElementById('root')!).render(
  <TranslationProvider>
    <LanguageProvider>
      <DocumentProvider storageAdapter={storageAdapter}>
        <AppShell />
      </DocumentProvider>
    </LanguageProvider>
  </TranslationProvider>,
)
```

`StorageAdapter` also has optional methods: `saveVersion`, `deleteAllVersions`, `persistFileHandle` and `restoreFileHandle`. For a complete implementation built on IndexedDB and the File System Access API, see [`local-storage-adapter.ts`](https://github.com/sutrata/sutrata/blob/main/packages/app/src/local-storage-adapter.ts) in the Sutrata app.

Inside the providers, `useDocument()` gives you the current Sutra text, its parsed AST and the editor state.

### Fonts

`fonts.css` declares Noto font faces for every supported script, loaded from `/fonts/*.woff2` on your own site. This package does not include the font files. Copy them from [`packages/app/public/fonts`](https://github.com/sutrata/sutrata/tree/main/packages/app/public/fonts) into your app's `/fonts/` path, or use your own `@font-face` rules. Without them, some scripts may display as missing-glyph boxes (tofu).

## Extension points

Beyond `StorageAdapter`, the package exports type definitions for more extension points: `AIProvider`, `SpeechProvider`, `SessionContext`, `PanelRegistry`, `CommandRegistry`, `ExportRegistry`, `CollabBinding` and `DecorationProvider`. **These are type-only previews and are not wired into the editor yet.** Their shapes may change before 1.0.

## Status

Pre-1.0. The API may change between minor versions.

## License

[GPL-3.0-or-later](https://github.com/sutrata/sutrata/blob/main/packages/editor/LICENSE).
