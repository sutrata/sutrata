export interface SpellLanguage {
  code: string
  /** Name in its own script. */
  label: string
  /** Dictionary file name (without extension) under the dictionary base URL. */
  file: string
  /** Matches one letter of the language's script. */
  script: RegExp
}

export const ENGLISH: SpellLanguage = { code: 'en', label: 'English', file: 'en_US', script: /\p{Script=Latin}/u }

/** The regional languages the writer can pair with English. Malayalam has no open Hunspell dictionary yet. */
export const REGIONAL_LANGUAGES: SpellLanguage[] = [
  { code: 'ta', label: 'தமிழ்', file: 'ta_IN', script: /\p{Script=Tamil}/u },
  { code: 'hi', label: 'हिन्दी', file: 'hi_IN', script: /\p{Script=Devanagari}/u },
  { code: 'mr', label: 'मराठी', file: 'mr_IN', script: /\p{Script=Devanagari}/u },
  { code: 'te', label: 'తెలుగు', file: 'te_IN', script: /\p{Script=Telugu}/u },
  { code: 'kn', label: 'ಕನ್ನಡ', file: 'kn_IN', script: /\p{Script=Kannada}/u },
  { code: 'bn', label: 'বাংলা', file: 'bn_IN', script: /\p{Script=Bengali}/u },
  { code: 'gu', label: 'ગુજરાતી', file: 'gu_IN', script: /\p{Script=Gujarati}/u },
  { code: 'pa', label: 'ਪੰਜਾਬੀ', file: 'pa_IN', script: /\p{Script=Gurmukhi}/u },
  { code: 'or', label: 'ଓଡ଼ିଆ', file: 'or_IN', script: /\p{Script=Oriya}/u },
]

export function languageByCode(code: string): SpellLanguage | undefined {
  return code === ENGLISH.code ? ENGLISH : REGIONAL_LANGUAGES.find(l => l.code === code)
}

/**
 * Which dictionary checks a word: Latin words go to English, words in the
 * regional language's script go to the regional dictionary. Anything else
 * (numbers, other scripts, Latin mixed into Indic letters) is not checked.
 */
export function languageForWord(word: string, regional: SpellLanguage | undefined): string | null {
  const latin = ENGLISH.script.test(word)
  const local = regional ? regional.script.test(word) : false
  if (latin && local) return null
  if (latin) return ENGLISH.code
  if (local) return regional!.code
  return null
}
