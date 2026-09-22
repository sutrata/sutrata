/** Languages offered for a document's `lang` / `lang-secondary` (BCP-47 primary tags).
 *  Indian languages first, then others commonly mixed into Indian scripts. A code found in
 *  a file but missing here is still shown (see `languageOptions`). */
export interface LanguageOption { code: string; label: string }

export const DOCUMENT_LANGUAGES: LanguageOption[] = [
  { code: 'hi', label: 'Hindi — हिन्दी' },
  { code: 'ta', label: 'Tamil — தமிழ்' },
  { code: 'te', label: 'Telugu — తెలుగు' },
  { code: 'ml', label: 'Malayalam — മലയാളം' },
  { code: 'kn', label: 'Kannada — ಕನ್ನಡ' },
  { code: 'bn', label: 'Bengali — বাংলা' },
  { code: 'mr', label: 'Marathi — मराठी' },
  { code: 'gu', label: 'Gujarati — ગુજરાતી' },
  { code: 'pa', label: 'Punjabi — ਪੰਜਾਬੀ' },
  { code: 'or', label: 'Odia — ଓଡ଼ିଆ' },
  { code: 'as', label: 'Assamese — অসমীয়া' },
  { code: 'ur', label: 'Urdu — اردو' },
  { code: 'si', label: 'Sinhala — සිංහල' },
  { code: 'sa', label: 'Sanskrit — संस्कृतम्' },
  { code: 'ne', label: 'Nepali — नेपाली' },
  { code: 'kok', label: 'Konkani — कोंकणी' },
  { code: 'mai', label: 'Maithili — मैथिली' },
  { code: 'bho', label: 'Bhojpuri — भोजपुरी' },
  { code: 'tcy', label: 'Tulu — ತುಳು' },
  { code: 'en', label: 'English' },
  { code: 'ar', label: 'Arabic — العربية' },
  { code: 'fr', label: 'French — Français' },
  { code: 'es', label: 'Spanish — Español' },
]

/** The list plus any codes already in the document that it does not contain. */
export function languageOptions(inUse: string[]): LanguageOption[] {
  const known = new Set(DOCUMENT_LANGUAGES.map(l => l.code))
  const extra = inUse.filter(c => c && !known.has(c)).map(c => ({ code: c, label: c }))
  return [...DOCUMENT_LANGUAGES, ...extra]
}
