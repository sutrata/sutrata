import { describe, it, expect } from 'vitest'
import { romanize, romanizeSutra, documentLanguages } from '../src/romanize'
import { parse } from '../src/parser'

const strict = (s: string, languages?: string[]) => romanize(s, { languages })
const readable = (s: string, languages?: string[]) => romanize(s, { variant: 'readable', languages })
const colloquial = (s: string, languages?: string[]) => romanize(s, { variant: 'colloquial', languages })

describe('romanize — strict ISO 15919', () => {
  it.each([
    // Devanagari
    ['नमस्ते', 'namastē'],
    ['राम', 'rāma'],
    ['कृष्ण', 'kr̥ṣṇa'],
    ['हाँ', 'hām̐'],
    ['संस्कृतम्', 'saṁskr̥tam'],
    ['डॉक्टर', 'ḍôkṭara'],
    ['दुःख', 'duḥkha'],
    ['सोऽहम्', 'sōʼham'],
    ['ॐ', 'ōm̐'],
    // Tamil
    ['தமிழ்', 'tamiḻ'],
    ['முருகன்', 'murukaṉ'],
    ['எஃகு', 'eḵku'],
    ['ஒன்று', 'oṉṟu'],
    // Telugu, Kannada, Malayalam
    ['తెలుగు', 'telugu'],
    ['ಕನ್ನಡ', 'kannaḍa'],
    ['മലയാളം', 'malayāḷaṁ'],
    // Bengali, Gurmukhi, Gujarati, Odia
    ['বাংলা', 'bāṁlā'],
    ['ਪੰਜਾਬੀ', 'paṁjābī'],
    ['ਪੱਗ', 'pagga'],
    ['ગુજરાતી', 'gujarātī'],
    ['ଓଡ଼ିଆ', 'ōṛiā'],
    // Sinhala (own block layout; prenasalized stops take a breve)
    ['සිංහල', 'siṁhala'],
    ['කොළඹ', 'koḷam̆ba'],
    ['ඇය', 'æya'],
    ['බෝධි', 'bōdhi'],
    ['අම්මා', 'ammā'],
  ])('%s → %s', (input, expected) => {
    expect(strict(input)).toBe(expected)
  })

  it('separates vowel hiatus and aspirate clusters with ":"', () => {
    expect(strict('अइ')).toBe('a:i')
    expect(strict('अउ')).toBe('a:u')
    expect(strict('ऐ')).toBe('ai')
    expect(strict('क्ह')).toBe('k:ha')
  })

  it('maps nukta letters whether precomposed or decomposed', () => {
    expect(strict('\u0958')).toBe('qa')          // precomposed क़ (NFC decomposes it)
    expect(strict('\u0915\u093C')).toBe('qa')    // क + nukta
    expect(strict('ज़िंदगी')).toBe('ziṁdagī')
    expect(strict('फ़')).toBe('fa')
    expect(strict('ड़')).toBe('ṛa')
    expect(strict('য়')).toBe('ẏa')               // Bengali
  })

  it('treats Malayalam atomic chillu and the old ZWJ sequence the same', () => {
    expect(strict('\u0D05\u0D35\u0D7B')).toBe('avan')               // atomic chillu ൻ
    expect(strict('\u0D05\u0D35\u0D28\u0D4D\u200D')).toBe('avan') // ന + virama + ZWJ
  })

  it('converts native digits and dandas, leaves ASCII alone', () => {
    expect(strict('२०२६।')).toBe('2026.')
    expect(strict('॥')).toBe('..')
    expect(strict('௧௨௩')).toBe('123')
    expect(strict('2026')).toBe('2026')
  })

  it('passes Latin text, punctuation and Sutra syntax through untouched', () => {
    expect(strict('Hello मीरा!')).toBe('Hello mīrā!')
    expect(strict('@VIKRAM (V.O.) ^')).toBe('@VIKRAM (V.O.) ^')
    expect(strict('## INT. HOUSE - NIGHT {#sc12}')).toBe('## INT. HOUSE - NIGHT {#sc12}')
    expect(strict('Main kal aaunga')).toBe('Main kal aaunga') // informally romanized Hindi
  })

  it('handles Sinhala conjuncts joined with ZWJ, digits, and kunddaliya', () => {
    expect(strict('ශ'+'\u0DCA\u200D'+'රී ලංකා')).toBe('śrī laṁkā')
    expect(strict('෧෨ ෴')).toBe('12 .')
  })

  it('keeps every Sinhala vowel in the readable variant', () => {
    expect(readable('ගෙදර', ['si'])).toBe('gedara')
    expect(readable('මං ගෙදර යනවා.', ['si'])).toBe('maṁ gedara yanavā.')
  })

  it('leaves non-ISO-15919 scripts (Urdu) unchanged', () => {
    expect(strict('اردو')).toBe('اردو')
  })

  it('handles mixed scripts in one line without tags', () => {
    expect(strict('There\'s no next train. மீரா சொன்னாள்.')).toBe('There\'s no next train. mīrā coṉṉāḷ.')
  })
})

describe('romanize — readable variant', () => {
  it('drops the word-final inherent vowel for Hindi', () => {
    expect(readable('राम')).toBe('rām')
    expect(readable('विक्रम')).toBe('vikram')
    expect(readable('हम ट्रेन छूट गए, है ना?')).toBe('ham ṭren chūṭ gae, hai nā?')
  })

  it('keeps it after a conjunct and in one-syllable words', () => {
    expect(readable('मित्र')).toBe('mitra')
    expect(readable('न')).toBe('na')
  })

  it('writes Indo-Aryan ē/ō as e/o', () => {
    expect(readable('मोहन')).toBe('mohan')
    expect(readable('नमस्ते')).toBe('namaste')
  })

  it('keeps Dravidian e/ē and o/ō distinct and never drops vowels', () => {
    expect(readable('ஒன்று', ['ta'])).toBe('oṉṟu')
    expect(readable('ஓடு', ['ta'])).toBe('ōṭu')
    expect(readable('കല', ['ml'])).toBe('kala')
  })

  it('keeps every vowel for Sanskrit and Odia', () => {
    expect(readable('राम', ['sa'])).toBe('rāma')
    expect(readable('ରାମ', ['or'])).toBe('rāma')
  })

  it('picks the rules from the first declared language in the run\'s script', () => {
    // English primary, Hindi secondary: Devanagari runs follow Hindi.
    expect(readable('राम', ['en', 'hi'])).toBe('rām')
    // Sanskrit declared before Hindi wins for Devanagari.
    expect(readable('राम', ['sa', 'hi'])).toBe('rāma')
  })

  it('omits ":" separators', () => {
    expect(readable('अइ')).toBe('ai')
  })
})

describe('romanize — colloquial variant', () => {
  it.each([
    // Devanagari — ASCII only, ee/oo for long i/u, single e/o regardless of length,
    // final schwa dropped like readable
    ['नमस्ते', 'namaste'],
    ['राम', 'raam'],
    ['मोहन', 'mohan'],
    ['कृष्ण', 'krishna'],
    ['डॉक्टर', 'doktar'],
    // anusvara: "m" before a labial or at the end of a word, "n" elsewhere
    ['संगीत', 'sangeet'],
    ['संभव', 'sambhav'],
    ['मलयालम्', 'malayaalam'],
    // candrabindu → n; avagraha dropped
    ['हाँ', 'haan'],
    ['सोऽहम्', 'soham'],
    // nukta letters: same ASCII as their base consonant's aspirate/voiced form
    ['ज़िंदगी', 'zindagee'],
    // Known limitation (also present in `readable`): the vowel after a bare consonant
    // cluster is kept rather than dropped, so this comes out "filma" not "film" — see
    // app spec §5.8.1 rule 7 and the pending mid-word schwa-deletion note.
    ['फ़िल्म', 'filma'],
    // Other Indo-Aryan scripts
    ['বাংলা', 'baanlaa'],
    ['ਪੰਜਾਬੀ', 'panjaabee'],
    ['ગુજરાતી', 'gujaraatee'],
    ['ଓଡ଼ିଆ', 'oriaa'],
    // Telugu/Kannada/Malayalam (already distinguish voiced/voiceless, so no Tamil-style
    // voicing rules apply)
    ['తెలుగు', 'telugu'],
    ['ಕನ್ನಡ', 'kannada'],
    ['മലയാളം', 'malayaalam'],
    // Sinhala
    ['සිංහල', 'sinhala'],
  ])('%s → %s', (input, expected) => {
    expect(colloquial(input)).toBe(expected)
  })

  it('character names are ASCII, matching the rest of a colloquial export', () => {
    expect(colloquial('विक्रम', ['hi'])).toBe('vikram')
    // मीरा ends in an explicit long-ā vowel sign, not an inherent vowel, so there is
    // nothing to drop — doubled the same as any other long ā (rā → "raa").
    expect(colloquial('मीरा', ['hi'])).toBe('meeraa')
  })

  it('passes Latin text and Sutra syntax through untouched', () => {
    expect(colloquial('Hello मीरा!')).toBe('Hello meeraa!')
    expect(colloquial('## INT. HOUSE - NIGHT {#sc12}')).toBe('## INT. HOUSE - NIGHT {#sc12}')
  })

  describe('Tamil voicing (க/ட/ப voiced/voiceless, ச s/ch, த always th)', () => {
    it('is voiceless word-initially', () => {
      expect(colloquial('கொண்டிருந்தவராக', ['ta'])).toMatch(/^ko/) // க word-initial → k
      expect(colloquial('பெரும்', ['ta'])).toMatch(/^pe/)          // ப word-initial → p
    })

    it('is voiced intervocalically and after a nasal', () => {
      expect(colloquial('கொண்டிருந்தவராக', ['ta'])).toContain('raaga') // intervocalic க → g
      expect(colloquial('குடும்பத்தில்', ['ta'])).toContain('mba')      // ம்ப (post-nasal) → mb, not mp
    })

    it('is voiceless when bare (virama) or geminated', () => {
      // வாழ்க்கையை: bare க் ("k") + geminated க ("k") → "kk"
      expect(colloquial('வாழ்க்கையை', ['ta'])).toContain('zhkkai')
    })

    it('ச is "s" except bare or geminated, where it is "ch"', () => {
      expect(colloquial('சேவை', ['ta'])).toBe('sevai')     // word-initial, vowel-bearing → s
      expect(colloquial('எசு', ['ta'])).toBe('esu')          // intervocalic → s
      expect(colloquial('பொதுச்', ['ta'])).toBe('pothuch')   // bare (virama) → ch
    })

    it('த is always "th", regardless of position', () => {
      expect(colloquial('குடும்பத்தில்', ['ta'])).toContain('ththil')
      expect(colloquial('அதே', ['ta'])).toBe('athe')
    })

    it('ற is "t" bare and "tr" with a vowel', () => {
      // முற்றுகையின்: bare ற் ("t") + vowel-bearing ற ("tru") → "ttru"
      expect(colloquial('முற்றுகையின்', ['ta'])).toContain('muttru')
    })

    it("doesn't apply Tamil voicing to Telugu/Kannada/Malayalam, which already have separate letters", () => {
      expect(colloquial('తెలుగు')).toBe('telugu') // Telugu త stays "t", not forced to "th"
    })
  })
})

describe('documentLanguages', () => {
  it('reads lang then lang-secondary in any of the frontmatter shapes', () => {
    expect(documentLanguages({ lang: 'hi', 'lang-secondary': '[en, sa]' })).toEqual(['hi', 'en', 'sa'])
    expect(documentLanguages({ lang: 'ta', 'lang-secondary': 'en' })).toEqual(['ta', 'en'])
    expect(documentLanguages({ lang: 'te', 'lang-secondary': ['en'] })).toEqual(['te', 'en'])
    expect(documentLanguages(undefined)).toEqual([])
  })
})

const SAMPLE = `---
title: आख़िरी ट्रेन
lang: hi
lang-secondary: [en]
---

## INT. रेलवे स्टेशन - रात {#sc1}
& synopsis: मीरा और विक्रम सच जानते हैं।

विक्रम टिकटें गिरा देता है।

@विक्रम
( धीरे से )
हम ट्रेन छूट गए, है ना?

@मीरा ^
There's no next train.

~ चल छैयाँ छैयाँ

# पात्र {#characters}

@विक्रम
& actor: रणबीर
`

describe('romanizeSutra', () => {
  it('keeps the document valid Sutra with the same structure', () => {
    const before = parse(SAMPLE)
    const after = parse(romanizeSutra(SAMPLE, { notice: false }))
    const shape = (d: ReturnType<typeof parse>) => JSON.stringify(d.children.map(c => [c.type, (c as { id?: unknown }).id ?? null]))
    expect(shape(after)).toBe(shape(before))
  })

  it('romanizes character names with the primary language convention in strict mode', () => {
    const out = romanizeSutra(SAMPLE, { notice: false })
    expect(out).toContain('@Vikram\n')
    expect(out).toContain('@Mīrā ^')
    // The same spelling is used where the name appears in action and metadata.
    expect(out).toContain('Vikram ṭikaṭēṁ girā dētā hai.')
    expect(out).toContain('& synopsis: Mīrā aura Vikram saca jānatē haiṁ.')
    // Other words stay strict.
    expect(out).toContain('hama ṭrēna chūṭa gaē, hai nā?')
  })

  it('does not replace a name inside a longer word', () => {
    const src = '@राम\nरामायण राम\n'
    const out = romanizeSutra(src, { notice: false })
    expect(out).toBe('@Rām\nrāmāyaṇa Rām\n')
  })

  it('dialogue scope romanizes only dialogue blocks and lyrics', () => {
    const out = romanizeSutra(SAMPLE, { scope: 'dialogue', notice: false })
    expect(out).toContain('title: आख़िरी ट्रेन')                   // title page native
    expect(out).toContain('## INT. रेलवे स्टेशन - रात {#sc1}')       // heading native
    expect(out).toContain('विक्रम टिकटें गिरा देता है।')              // action native
    expect(out).toContain('@Vikram\n( dhīrē sē )\nhama ṭrēna chūṭa gaē, hai nā?')
    expect(out).toContain('~ cala chaiyām̐ chaiyām̐')
    expect(out).toContain('@विक्रम\n& actor: रणबीर')                  // registry native
  })

  it('adds a notice naming the scheme and variant, with no page-reference disclaimer', () => {
    const out = romanizeSutra(SAMPLE, { variant: 'readable' })
    expect(out).toContain('>> ROMANIZED COPY · readable, ISO 15919 <<')
    expect(out).not.toContain('PAGE REFERENCE')
    const doc = parse(out)
    expect(doc.children.some(c => c.type === 'centered')).toBe(true)
  })

  it('labels the strict and colloquial notices too', () => {
    expect(romanizeSutra(SAMPLE, { variant: 'strict' })).toContain('>> ROMANIZED COPY · ISO 15919 <<')
    expect(romanizeSutra(SAMPLE, { variant: 'colloquial' })).toContain('>> ROMANIZED COPY · casual <<')
  })

  it('preserves CRLF line endings', () => {
    const out = romanizeSutra('@मीरा\r\nहाँ\r\n', { notice: false })
    expect(out).toBe('@Mīrā\r\nhām̐\r\n')
  })
})
