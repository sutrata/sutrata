// Bengali romanization table (ISO 15919 / ITRANS-style)
// Keys are romanized input, values are Bengali codepoints
export const bengaliTable: Record<string, string> = {
  // Vowels
  'a': 'অ', 'aa': 'আ', 'A': 'আ', 'i': 'ই', 'ii': 'ঈ', 'I': 'ঈ',
  'u': 'উ', 'uu': 'ঊ', 'U': 'ঊ', 'e': 'এ', 'ai': 'ঐ',
  'o': 'ও', 'au': 'ঔ', 'ri': 'ঋ',

  // Vowel signs
  'aa_sign': 'া', 'i_sign': 'ি', 'ii_sign': 'ী', 'u_sign': 'ু',
  'uu_sign': 'ূ', 'e_sign': 'ে', 'ai_sign': 'ৈ', 'o_sign': 'ো',
  'au_sign': 'ৌ', 'ri_sign': 'ৃ',

  // Hasanta (virama equivalent)
  '_': '্',

  // Consonants
  'k': 'ক', 'kh': 'খ', 'g': 'গ', 'gh': 'ঘ', 'ng': 'ঙ',
  'ch': 'চ', 'chh': 'ছ', 'j': 'জ', 'jh': 'ঝ', 'ny': 'ঞ',
  'T': 'ট', 'Th': 'ঠ', 'D': 'ড', 'Dh': 'ঢ', 'N': 'ণ',
  't': 'ত', 'th': 'থ', 'd': 'দ', 'dh': 'ধ', 'n': 'ন',
  'p': 'প', 'ph': 'ফ', 'b': 'ব', 'bh': 'ভ', 'm': 'ম',
  'y': 'য', 'r': 'র', 'l': 'ল', 'v': 'ব', 'w': 'ব',
  'sh': 'শ', 'Sh': 'ষ', 's': 'স', 'h': 'হ',

  // Anusvara, visarga
  'M': 'ং', 'H': 'ঃ',
}
