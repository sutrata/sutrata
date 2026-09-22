// Telugu romanization table (ISO 15919 / ITRANS-style)
// Keys are romanized input, values are Telugu codepoints
export const teluguTable: Record<string, string> = {
  // Vowels
  'a': 'అ', 'aa': 'ఆ', 'A': 'ఆ', 'i': 'ఇ', 'ii': 'ఈ', 'I': 'ఈ',
  'u': 'ఉ', 'uu': 'ఊ', 'U': 'ఊ', 'e': 'ఎ', 'ee': 'ఏ', 'ai': 'ఐ',
  'o': 'ఒ', 'oo': 'ఓ', 'au': 'ఔ', 'ri': 'ఋ',

  // Vowel signs
  'aa_sign': 'ా', 'i_sign': 'ి', 'ii_sign': 'ీ', 'u_sign': 'ు',
  'uu_sign': 'ూ', 'e_sign': 'ె', 'ee_sign': 'ే', 'ai_sign': 'ై',
  'o_sign': 'ొ', 'oo_sign': 'ో', 'au_sign': 'ౌ', 'ri_sign': 'ృ',

  // Virama
  '_': '్',

  // Consonants
  'k': 'క', 'kh': 'ఖ', 'g': 'గ', 'gh': 'ఘ', 'ng': 'ఙ',
  'ch': 'చ', 'chh': 'ఛ', 'j': 'జ', 'jh': 'ఝ', 'ny': 'ఞ',
  'T': 'ట', 'Th': 'ఠ', 'D': 'డ', 'Dh': 'ఢ', 'N': 'ణ',
  't': 'త', 'th': 'థ', 'd': 'ద', 'dh': 'ధ', 'n': 'న',
  'p': 'ప', 'ph': 'ఫ', 'b': 'బ', 'bh': 'భ', 'm': 'మ',
  'y': 'య', 'r': 'ర', 'l': 'ల', 'v': 'వ', 'w': 'వ',
  'sh': 'శ', 'Sh': 'ష', 's': 'స', 'h': 'హ', 'L': 'ళ', 'rr': 'ఱ',

  // Anusvara, visarga
  'M': 'ం', 'H': 'ః',
}
