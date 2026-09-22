// Odia romanization table (ISO 15919 / ITRANS-style)
// Keys are romanized input, values are Odia codepoints
export const odiaTable: Record<string, string> = {
  // Vowels
  'a': 'ଅ', 'aa': 'ଆ', 'A': 'ଆ', 'i': 'ଇ', 'ii': 'ଈ', 'I': 'ଈ',
  'u': 'ଉ', 'uu': 'ଊ', 'U': 'ଊ', 'e': 'ଏ', 'ai': 'ଐ',
  'o': 'ଓ', 'au': 'ଔ', 'ri': 'ଋ',

  // Vowel signs
  'aa_sign': 'ା', 'i_sign': 'ି', 'ii_sign': 'ୀ', 'u_sign': 'ୁ',
  'uu_sign': 'ୂ', 'e_sign': 'େ', 'ai_sign': 'ୈ', 'o_sign': 'ୋ',
  'au_sign': 'ୌ', 'ri_sign': 'ୃ',

  // Virama
  '_': '୍',

  // Consonants
  'k': 'କ', 'kh': 'ଖ', 'g': 'ଗ', 'gh': 'ଘ', 'ng': 'ଙ',
  'ch': 'ଚ', 'chh': 'ଛ', 'j': 'ଜ', 'jh': 'ଝ', 'ny': 'ଞ',
  'T': 'ଟ', 'Th': 'ଠ', 'D': 'ଡ', 'Dh': 'ଢ', 'N': 'ଣ',
  't': 'ତ', 'th': 'ଥ', 'd': 'ଦ', 'dh': 'ଧ', 'n': 'ନ',
  'p': 'ପ', 'ph': 'ଫ', 'b': 'ବ', 'bh': 'ଭ', 'm': 'ମ',
  'y': 'ଯ', 'r': 'ର', 'l': 'ଲ', 'v': 'ଵ', 'w': 'ଵ',
  'sh': 'ଶ', 'Sh': 'ଷ', 's': 'ସ', 'h': 'ହ', 'L': 'ଳ',

  // Anusvara, visarga
  'M': 'ଂ', 'H': 'ଃ',
}
