// Malayalam romanization table (ISO 15919 / ITRANS-style)
// Keys are romanized input, values are Malayalam codepoints
export const malayalamTable: Record<string, string> = {
  // Vowels
  'a': 'അ', 'aa': 'ആ', 'A': 'ആ', 'i': 'ഇ', 'ii': 'ഈ', 'I': 'ഈ',
  'u': 'ഉ', 'uu': 'ഊ', 'U': 'ഊ', 'e': 'എ', 'ee': 'ഏ', 'ai': 'ഐ',
  'o': 'ഒ', 'oo': 'ഓ', 'au': 'ഔ', 'ri': 'ഋ',

  // Vowel signs
  'aa_sign': 'ാ', 'i_sign': 'ി', 'ii_sign': 'ീ', 'u_sign': 'ു',
  'uu_sign': 'ൂ', 'e_sign': 'െ', 'ee_sign': 'േ', 'ai_sign': 'ൈ',
  'o_sign': 'ൊ', 'oo_sign': 'ോ', 'au_sign': 'ൌ', 'ri_sign': 'ൃ',

  // Virama (chandrakkala)
  '_': '്',

  // Consonants
  'k': 'ക', 'kh': 'ഖ', 'g': 'ഗ', 'gh': 'ഘ', 'ng': 'ങ',
  'ch': 'ച', 'chh': 'ഛ', 'j': 'ജ', 'jh': 'ഝ', 'ny': 'ഞ',
  'T': 'ട', 'Th': 'ഠ', 'D': 'ഡ', 'Dh': 'ഢ', 'N': 'ണ',
  't': 'ത', 'th': 'ഥ', 'd': 'ദ', 'dh': 'ധ', 'n': 'ന',
  'p': 'പ', 'ph': 'ഫ', 'b': 'ബ', 'bh': 'ഭ', 'm': 'മ',
  'y': 'യ', 'r': 'ര', 'l': 'ല', 'v': 'വ', 'w': 'വ',
  'sh': 'ശ', 'Sh': 'ഷ', 's': 'സ', 'h': 'ഹ', 'L': 'ള', 'zh': 'ഴ', 'rr': 'റ',

  // Anusvara, visarga
  'M': 'ം', 'H': 'ഃ',
}
