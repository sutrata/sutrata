---
"@sutrata/editor": minor
---

Spell check for English plus one regional language (Tamil, Hindi, Marathi, Telugu, Kannada, Bengali, Gujarati, Punjabi or Odia), switched on in Settings. Words are checked with Hunspell (WebAssembly) in a worker; the dictionaries are fetched from `/dict/` (see `scripts/fetch-dictionaries.mjs`, or `configureSpellcheck({ dictionaryBaseUrl })`).

The scene heading pencil now fires a cancelable `EDIT_SCENE_ATTRS_EVENT` after placing the caret in the scene; a panel that edits scene attributes can take it, otherwise the attribute menu opens as before. Scene names in the navigator show a tooltip when they are clipped. The language picker in the status bar (which only inserted a `{lang=..}` tag) is removed.

### Migration

None for embedders. The `setSpellcheckLanguage` export (never public) is gone.

Right-click a misspelled word for suggestions, or to ignore it (the ignore list is kept in the browser and managed in Settings). Character names are ignored automatically, for as long as a character has that name in the script.

The status bar has a spell check control after the word count, as in Word: it shows off, EN or EN + the regional language, and opens a popover with the same options as Settings.
