// Kannada romanization table (ISO 15919 / ITRANS-style)
// Keys are romanized input, values are Kannada codepoints
export const kannadaTable: Record<string, string> = {
  // Vowels
  'a': 'ಅ', 'aa': 'ಆ', 'A': 'ಆ', 'i': 'ಇ', 'ii': 'ಈ', 'I': 'ಈ',
  'u': 'ಉ', 'uu': 'ಊ', 'U': 'ಊ', 'e': 'ಎ', 'ee': 'ಏ', 'ai': 'ಐ',
  'o': 'ಒ', 'oo': 'ಓ', 'au': 'ಔ', 'ri': 'ಋ',

  // Vowel signs
  'aa_sign': 'ಾ', 'i_sign': 'ಿ', 'ii_sign': 'ೀ', 'u_sign': 'ು',
  'uu_sign': 'ೂ', 'e_sign': 'ೆ', 'ee_sign': 'ೇ', 'ai_sign': 'ೈ',
  'o_sign': 'ೊ', 'oo_sign': 'ೋ', 'au_sign': 'ೌ', 'ri_sign': 'ೃ',

  // Virama
  '_': '್',

  // Consonants
  'k': 'ಕ', 'kh': 'ಖ', 'g': 'ಗ', 'gh': 'ಘ', 'ng': 'ಙ',
  'ch': 'ಚ', 'chh': 'ಛ', 'j': 'ಜ', 'jh': 'ಝ', 'ny': 'ಞ',
  'T': 'ಟ', 'Th': 'ಠ', 'D': 'ಡ', 'Dh': 'ಢ', 'N': 'ಣ',
  't': 'ತ', 'th': 'ಥ', 'd': 'ದ', 'dh': 'ಧ', 'n': 'ನ',
  'p': 'ಪ', 'ph': 'ಫ', 'b': 'ಬ', 'bh': 'ಭ', 'm': 'ಮ',
  'y': 'ಯ', 'r': 'ರ', 'l': 'ಲ', 'v': 'ವ', 'w': 'ವ',
  'sh': 'ಶ', 'Sh': 'ಷ', 's': 'ಸ', 'h': 'ಹ', 'L': 'ಳ',

  // Anusvara, visarga
  'M': 'ಂ', 'H': 'ಃ',
}
