#!/usr/bin/env node
// Downloads the Hunspell dictionaries the spell checker uses (LibreOffice's
// dictionaries repo, pinned) into a public folder: node fetch-dictionaries.mjs <dir>
// Files already there are kept. The dictionaries carry their own licences
// (MPL, GPL, BSD, ...), which is why they are fetched, not committed.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const COMMIT = '32b006a2c22a4ac7e8ed3f03346f7b3d85a970a4'
// served name -> path in the LibreOffice repo
const FILES = {
  en_US: 'en/en_US', ta_IN: 'ta_IN/ta_IN', hi_IN: 'hi_IN/hi_IN', mr_IN: 'mr_IN/mr_IN', te_IN: 'te_IN/te_IN',
  kn_IN: 'kn_IN/kn_IN', bn_IN: 'bn_BD/bn_BD', gu_IN: 'gu_IN/gu_IN', pa_IN: 'pa_IN/pa_IN', or_IN: 'or_IN/or_IN',
}

const out = process.argv[2]
if (!out) { console.error('usage: fetch-dictionaries.mjs <output dir>'); process.exit(1) }
mkdirSync(out, { recursive: true })

let failed = false
for (const [name, source] of Object.entries(FILES)) {
  for (const ext of ['aff', 'dic']) {
    const target = join(out, `${name}.${ext}`)
    if (existsSync(target)) continue
    const url = `https://raw.githubusercontent.com/LibreOffice/dictionaries/${COMMIT}/${source}.${ext}`
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`${res.status}`)
      writeFileSync(target, Buffer.from(await res.arrayBuffer()))
      console.log(`fetched ${name}.${ext}`)
    } catch (e) {
      failed = true
      console.error(`could not fetch ${url}: ${e.message}`)
    }
  }
}
// A missing dictionary only turns that language's spell check off; do not fail the build.
if (failed) console.error('Some dictionaries are missing; spell check will be unavailable for them.')
