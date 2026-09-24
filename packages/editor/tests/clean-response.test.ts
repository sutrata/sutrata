import { cleanVoiceResponse } from '../src/ai/clean-response'

describe('cleanVoiceResponse', () => {
  it('should clean voice responses by stripping code blocks, reasoning, and shorthand comments', () => {
    const inputCluttered = `
*   Input: Raw voice transcript "New Scene scene #2 Exterior swimming pool daytime."
  *   Task: Convert to Sutra screenplay format.
  *   Sutra Rules:
      *   Scene Headings: \`##\` (e.g., \`## INT. COFFEE SHOP - DAY\`).
      *   Format: \`## EXT. SWIMMING POOL - DAY {#2}\` (Standard screenplay shorthand for Exterior and Daytime).

  ## EXT. SWIMMING POOL - DAY {#2}
    `;
    expect(cleanVoiceResponse(inputCluttered)).toBe('## EXT. SWIMMING POOL - DAY {#2}');

    const inputWithCodeBlock = '```cine\n## EXT. SWIMMING POOL - DAY {#2}\n```';
    expect(cleanVoiceResponse(inputWithCodeBlock)).toBe('## EXT. SWIMMING POOL - DAY {#2}');

    const inputWithTrailingShorthand = '## EXT. SWIMMING POOL - DAY {#2} (Standard screenplay shorthand for Exterior and Daytime)';
    expect(cleanVoiceResponse(inputWithTrailingShorthand)).toBe('## EXT. SWIMMING POOL - DAY {#2}');

    const userGemmaClutter = `
Rules:
         Scene ID: Append as \`{#ID}\` at the end.

     "7" -> Scene ID {#7}
     "exterior" -> EXT.
     "Road" -> ROAD
     "evening" -> EVENING

  *   \`## EXT. ROAD - EVENING {#7}
    `;
    expect(cleanVoiceResponse(userGemmaClutter)).toBe('## EXT. ROAD - EVENING {#7}');
  });

  it('keeps the blank lines that separate Sutra blocks', () => {
    const input = '## INT. HOUSE - NIGHT\n\n@RAJ\nHello.\n\n\n\n>> CUT TO:'
    expect(cleanVoiceResponse(input)).toBe('## INT. HOUSE - NIGHT\n\n@RAJ\nHello.\n\n>> CUT TO:')
  })
})
