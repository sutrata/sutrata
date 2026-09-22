export interface DictionaryManifest {
  aff: string  // path relative to public/
  dic: string  // path relative to public/
}

/**
 * Dictionary manifest: maps BCP-47 language code → asset paths under public/dict/.
 * The actual .dic/.aff files are not committed; see public/dict/README.md for acquisition.
 */
export const DICTIONARIES: Record<string, DictionaryManifest> = {
  'en': { aff: '/dict/en_US.aff', dic: '/dict/en_US.dic' },
  'hi': { aff: '/dict/hi_IN.aff', dic: '/dict/hi_IN.dic' },
  'ta': { aff: '/dict/ta_IN.aff', dic: '/dict/ta_IN.dic' },
  'te': { aff: '/dict/te_IN.aff', dic: '/dict/te_IN.dic' },
  'kn': { aff: '/dict/kn_IN.aff', dic: '/dict/kn_IN.dic' },
  'ml': { aff: '/dict/ml_IN.aff', dic: '/dict/ml_IN.dic' },
  'bn': { aff: '/dict/bn_IN.aff', dic: '/dict/bn_IN.dic' },
  'gu': { aff: '/dict/gu_IN.aff', dic: '/dict/gu_IN.dic' },
  'pa': { aff: '/dict/pa_IN.aff', dic: '/dict/pa_IN.dic' },
  'or': { aff: '/dict/or_IN.aff', dic: '/dict/or_IN.dic' },
}
