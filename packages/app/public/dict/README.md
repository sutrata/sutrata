# Spellcheck dictionary assets

Hunspell `.aff`/`.dic` pairs for the spell check (Settings > Spell check). They are
not committed: `pnpm --filter @sutrata/app dictionaries` (also run by `dev` and `build`)
downloads a pinned copy from https://github.com/LibreOffice/dictionaries into this
folder, via `packages/editor/scripts/fetch-dictionaries.mjs`. Files already here are kept.

English (`en_US`) is always checked; the writer picks one regional language to go with it:
Tamil, Hindi, Marathi, Telugu, Kannada, Bengali, Gujarati, Punjabi or Odia. There is no
open Hunspell dictionary for Malayalam yet.

Each dictionary has its own licence (BSD, MPL, GPL, ...); see the folders in the source repo.
The files are fetched when a language is first used and cached by the service worker.
