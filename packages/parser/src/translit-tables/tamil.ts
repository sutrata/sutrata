// Tamil romanization table (ISO 15919 / ITRANS-style)
// Keys are romanized input, values are Tamil codepoints
export const tamilTable: Record<string, string> = {
  // Vowels
  'a': 'அ', 'aa': 'ஆ', 'A': 'ஆ', 'i': 'இ', 'ii': 'ஈ', 'I': 'ஈ',
  'u': 'உ', 'uu': 'ஊ', 'U': 'ஊ', 'e': 'எ', 'ee': 'ஏ', 'E': 'ஏ',
  'ai': 'ஐ', 'o': 'ஒ', 'oo': 'ஓ', 'O': 'ஓ', 'au': 'ஔ',

  // Vowel signs
  'aa_sign': 'ா', 'i_sign': 'ி', 'ii_sign': 'ீ', 'u_sign': 'ு',
  'uu_sign': 'ூ', 'e_sign': 'ெ', 'ee_sign': 'ே', 'ai_sign': 'ை',
  'o_sign': 'ொ', 'oo_sign': 'ோ', 'au_sign': 'ௌ',

  // Virama (pulli)
  '_': '்',

  // Consonants
  'k': 'க', 'ng': 'ங', 'ch': 'ச', 'ny': 'ஞ', 'T': 'ட', 'N': 'ண',
  't': 'த', 'n': 'ந', 'p': 'ப', 'm': 'ம', 'y': 'ய', 'r': 'ர',
  'l': 'ல', 'v': 'வ', 'zh': 'ழ', 'L': 'ள', 'rr': 'ற', 'nn': 'ன',
  'sh': 'ஶ', 's': 'ஸ', 'h': 'ஹ',
}
