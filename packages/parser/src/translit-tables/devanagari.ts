// Devanagari romanization table (ISO 15919 / ITRANS-style)
// Keys are romanized input, values are Devanagari codepoints
export const devanagariTable: Record<string, string> = {
  // Independent vowels
  'a': 'अ', 'aa': 'आ', 'A': 'आ', 'i': 'इ', 'ii': 'ई', 'I': 'ई',
  'u': 'उ', 'uu': 'ऊ', 'U': 'ऊ', 'e': 'ए', 'ai': 'ऐ', 'o': 'ओ', 'au': 'औ',
  'ri': 'ऋ',

  // Dependent vowel signs (used after consonants)
  'aa_sign': 'ा', 'A_sign': 'ा', 'i_sign': 'ि', 'ii_sign': 'ी', 'I_sign': 'ी',
  'u_sign': 'ु', 'uu_sign': 'ू', 'U_sign': 'ू', 'e_sign': 'े', 'ai_sign': 'ै',
  'o_sign': 'ो', 'au_sign': 'ौ', 'ri_sign': 'ृ',

  // Virama (halant) - suppresses inherent 'a'
  '_': '्',

  // Consonants (inherent 'a' follows each)
  'k': 'क', 'kh': 'ख', 'g': 'ग', 'gh': 'घ', 'ng': 'ङ',
  'ch': 'च', 'chh': 'छ', 'j': 'ज', 'jh': 'झ', 'ny': 'ञ',
  'T': 'ट', 'Th': 'ठ', 'D': 'ड', 'Dh': 'ढ', 'N': 'ण',
  't': 'त', 'th': 'थ', 'd': 'द', 'dh': 'ध', 'n': 'न',
  'p': 'प', 'ph': 'फ', 'b': 'ब', 'bh': 'भ', 'm': 'म',
  'y': 'य', 'r': 'र', 'l': 'ल', 'v': 'व', 'w': 'व',
  'sh': 'श', 'Sh': 'ष', 's': 'स', 'h': 'ह', 'L': 'ळ',

  // Anusvara, visarga
  'M': 'ं', 'H': 'ः',

  // Numbers
  '0': '०', '1': '१', '2': '२', '3': '३', '4': '४',
  '5': '५', '6': '६', '7': '७', '8': '८', '9': '९',
}
