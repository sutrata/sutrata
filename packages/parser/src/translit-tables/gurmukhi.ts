// Gurmukhi romanization table (ISO 15919 / ITRANS-style)
// Keys are romanized input, values are Gurmukhi codepoints
export const gurmukhiTable: Record<string, string> = {
  // Vowels
  'a': 'ਅ', 'aa': 'ਆ', 'A': 'ਆ', 'i': 'ਇ', 'ii': 'ਈ', 'I': 'ਈ',
  'u': 'ਉ', 'uu': 'ਊ', 'U': 'ਊ', 'e': 'ਏ', 'ai': 'ਐ',
  'o': 'ਓ', 'au': 'ਔ',

  // Vowel signs
  'aa_sign': 'ਾ', 'i_sign': 'ਿ', 'ii_sign': 'ੀ', 'u_sign': 'ੁ',
  'uu_sign': 'ੂ', 'e_sign': 'ੇ', 'ai_sign': 'ੈ', 'o_sign': 'ੋ',
  'au_sign': 'ੌ',

  // Virama
  '_': '੍',

  // Consonants
  'k': 'ਕ', 'kh': 'ਖ', 'g': 'ਗ', 'gh': 'ਘ', 'ng': 'ਙ',
  'ch': 'ਚ', 'chh': 'ਛ', 'j': 'ਜ', 'jh': 'ਝ', 'ny': 'ਞ',
  'T': 'ਟ', 'Th': 'ਠ', 'D': 'ਡ', 'Dh': 'ਢ', 'N': 'ਣ',
  't': 'ਤ', 'th': 'ਥ', 'd': 'ਦ', 'dh': 'ਧ', 'n': 'ਨ',
  'p': 'ਪ', 'ph': 'ਫ', 'b': 'ਬ', 'bh': 'ਭ', 'm': 'ਮ',
  'y': 'ਯ', 'r': 'ਰ', 'l': 'ਲ', 'v': 'ਵ', 'w': 'ਵ',
  'sh': 'ਸ਼', 's': 'ਸ', 'h': 'ਹ', 'L': 'ਲ਼',

  // Anusvara, visarga
  'M': 'ਂ', 'H': 'ਃ',
}
