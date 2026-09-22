// Gujarati romanization table (ISO 15919 / ITRANS-style)
// Keys are romanized input, values are Gujarati codepoints
export const gujaratiTable: Record<string, string> = {
  // Vowels
  'a': 'અ', 'aa': 'આ', 'A': 'આ', 'i': 'ઇ', 'ii': 'ઈ', 'I': 'ઈ',
  'u': 'ઉ', 'uu': 'ઊ', 'U': 'ઊ', 'e': 'એ', 'ai': 'ઐ',
  'o': 'ઓ', 'au': 'ઔ', 'ri': 'ઋ',

  // Vowel signs
  'aa_sign': 'ા', 'i_sign': 'િ', 'ii_sign': 'ી', 'u_sign': 'ુ',
  'uu_sign': 'ૂ', 'e_sign': 'ે', 'ai_sign': 'ૈ', 'o_sign': 'ો',
  'au_sign': 'ૌ', 'ri_sign': 'ૃ',

  // Virama
  '_': '્',

  // Consonants
  'k': 'ક', 'kh': 'ખ', 'g': 'ગ', 'gh': 'ઘ', 'ng': 'ઙ',
  'ch': 'ચ', 'chh': 'છ', 'j': 'જ', 'jh': 'ઝ', 'ny': 'ઞ',
  'T': 'ટ', 'Th': 'ઠ', 'D': 'ડ', 'Dh': 'ઢ', 'N': 'ણ',
  't': 'ત', 'th': 'થ', 'd': 'દ', 'dh': 'ધ', 'n': 'ન',
  'p': 'પ', 'ph': 'ફ', 'b': 'બ', 'bh': 'ભ', 'm': 'મ',
  'y': 'ય', 'r': 'ર', 'l': 'લ', 'v': 'વ', 'w': 'વ',
  'sh': 'શ', 'Sh': 'ષ', 's': 'સ', 'h': 'હ', 'L': 'ળ',

  // Anusvara, visarga
  'M': 'ં', 'H': 'ઃ',
}
