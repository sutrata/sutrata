/**
 * Strip the chatter models wrap around Sutra output (code fences, list
 * bullets, restated rules, "->" reasoning lines), keeping the blank lines
 * that separate Sutra blocks. Applied to every AI formatting result before
 * it is inserted, whichever AIProvider produced it.
 */
export function cleanVoiceResponse(text: string): string {
  let cleaned = text.trim();
  // Strip markdown code block wrapper if present
  cleaned = cleaned.replace(/^```[a-zA-Z0-9]*\n/, '').replace(/\n```$/, '');

  const lines = cleaned.split('\n');
  const filteredLines = lines.map(line => {
    let l = line.trim();
    // Strip leading list bullet (e.g. *, -, +, •) and spaces
    l = l.replace(/^[*•\-+]\s*/, '').trim();
    // Strip leading/trailing backticks if any
    l = l.replace(/^`+/, '').replace(/`+$/, '').trim();
    
    // Strip common explanatory trailing comments in parens
    l = l.replace(/\s*\(Standard screenplay shorthand[^)]*\)/gi, '');
    l = l.replace(/\s*\(Standard shorthand[^)]*\)/gi, '');
    return l;
  }).filter(line => {
    const trimmed = line.toLowerCase();
    // Keep blank lines: they separate Sutra blocks (a blank line ends dialogue).
    if (!trimmed) return true;

    // Discard reasoning/mapping/explanation patterns
    if (
      trimmed.includes('->') ||
      trimmed.includes('=>') ||
      trimmed.startsWith('input:') ||
      trimmed.startsWith('task:') ||
      trimmed.startsWith('rules:') ||
      trimmed.startsWith('instructions:') ||
      trimmed.startsWith('sutra rules:') ||
      trimmed.startsWith('scene headings:') ||
      trimmed.startsWith('scene id:') ||
      trimmed.startsWith('characters:') ||
      trimmed.startsWith('parentheticals:') ||
      trimmed.startsWith('dialogue:') ||
      trimmed.startsWith('transitions:') ||
      trimmed.startsWith('lyrics:') ||
      trimmed.startsWith('action:') ||
      trimmed.startsWith('format:') ||
      trimmed.startsWith('components:') ||
      trimmed.startsWith('output only') ||
      trimmed.startsWith('no markdown') ||
      trimmed.includes('convert it into valid sutra') ||
      trimmed.includes('sutra syntax rules') ||
      trimmed.includes('clearly a scene heading') ||
      trimmed.includes('screenplay shorthand') ||
      trimmed.includes('append as')
    ) {
      return false;
    }

    return true;
  });

  // Collapse runs of blank lines left behind by discarded explanation lines.
  return filteredLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
