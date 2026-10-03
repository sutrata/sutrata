export const VOICE_FORMAT_SYSTEM_PROMPT = `You are Sutrata's AI screenplay formatter.
Your task is to take a raw voice dictation transcript (which may contain explicit formatting keywords like "scene", "character", "dialogue", "parenthetical", "transition") and convert it into valid Sutra screenplay format.

Sutra syntax rules (one element per block; separate blocks with a blank line):
1. Scene Headings: Start with "##" (e.g., "## INT. COFFEE SHOP - DAY"). If a scene number/ID is specified (e.g., "scene #2", "scene 2", or "scene 3A"), append it as a Sutra attribute ID at the end of the scene heading, like "{#2}" or "{#3A}" (e.g., "## EXT. SWIMMING POOL - DAY {#2}").
2. Scene Metadata: Lines directly under a scene heading starting with "&", as "& key: value" (e.g., "& time: DAY", "& synopsis: Raj waits for Meera."). Only add metadata the speaker actually gave.
3. Character Cues: Start with "@", alone on a line (e.g., "@RAJ", "@मीरा"). Keep the speaker's casing and script; never rely on ALL CAPS.
4. Parentheticals: In parentheses, on a line by itself under the character cue (e.g., "(whispering)").
5. Dialogue: The lines directly after the character cue or parenthetical, with no blank line in between. A blank line ends the dialogue block.
6. Transitions: Start with ">>" (e.g., ">> CUT TO:").
7. Lyrics: Prefixed with "~ " (e.g., "~ Sing a song").
8. Action: Standard descriptive paragraph.

CRITICAL INSTRUCTIONS:
- Preserve Indic/Unicode characters and mixed-language code-switching exactly as transcribed. Do NOT translate non-English text to English.
- Output ONLY the formatted Sutra text.
- Do NOT include any explanations, steps, reasoning, bullet points, meta-commentary, or introductory/concluding text.
- Do NOT output headings, drafts, prefixes, or suffixes.
- Do NOT wrap in markdown code blocks like \`\`\`cine.
- The output must contain nothing but the final formatted Sutra screenplay lines.
`;

/**
 * Combined synopsis+duration prompt. Merged into one call (and one JSON
 * response) instead of two separate requests to halve per-scene LLM cost.
 * Paired with SCENE_METADATA_SCHEMA — the response format instructions
 * (JSON-only, matching the schema) are appended by callAIStructured, not
 * hardcoded here, so the same prompt works across providers.
 */
export const SCENE_METADATA_PROMPT = `[INSTRUCTION]
Analyze the screenplay scene provided below and produce two fields:
1. "synopsis": A concise, 1-2 sentence synopsis of the main action and conflict.
2. "duration": The estimated onscreen duration of the scene, in "MM:SS" format (e.g. 01:30).

[RULES FOR "synopsis"]
1. Match the language of the scene: If the scene is in Tamil, the synopsis MUST be written in Tamil. If the scene is in Hindi, the synopsis MUST be written in Hindi, etc. Do NOT translate to English.
2. Do NOT include any explanations, definitions, drafts, translations, or bullet points.
3. Do NOT include headings, prefixes (such as "Synopsis:" or "Draft:"), or suffixes.
4. Absolutely no English introduction, reasoning, or meta-commentary.

[RULES FOR "duration"]
1. Dialogue speed: ~140 words per minute.
2. Action lines: ~4 seconds per line of description.
3. The value must be ONLY the estimated duration in "MM:SS" format — no calculations, explanations, breakdown, or notes.
`;

/** JSON schema for SCENE_METADATA_PROMPT's response — see callAIStructured. */
export const SCENE_METADATA_SCHEMA = {
  type: 'object',
  properties: {
    synopsis: {
      type: 'string',
      description: "1-2 sentence synopsis of the scene's main action and conflict, in the scene's own language/script",
    },
    duration: {
      type: 'string',
      description: 'Estimated onscreen duration of the scene as MM:SS',
    },
  },
  required: ['synopsis', 'duration'],
  additionalProperties: false,
} as const;


/**
 * AI-assisted import (import/ai-import.ts): turns a chunk of a screenplay
 * written elsewhere (Word, plain text, Markdown) into Sutra. The content
 * check after each call compares words in and out, so the rules below about
 * never adding, dropping or translating text are enforced, not just asked.
 */
export const IMPORT_FORMAT_SYSTEM_PROMPT = `You convert screenplay text into Sutra, a plain-text screenplay format. You receive one chunk of a longer script; format only that chunk.

Sutra syntax (separate blocks with one blank line):
1. Scene heading: "## " + the heading text as written (e.g. "## INT. COFFEE SHOP - DAY", "## अंदर. रेलवे स्टेशन - रात"). If the source numbers the scene, append the number as "{#12}" at the end of the heading line and drop it from the text.
2. Action: a plain paragraph with no sigil. Join the source's hard-wrapped lines into one continuous line (see "Line breaks").
3. Character cue: "@" + the name exactly as written, alone on a line, optionally followed by an extension like "(V.O.)". Never change the name's case or script.
4. Dialogue: the lines directly under the cue, no blank line in between. Join the source's hard-wrapped lines into continuous text (see "Line breaks").
5. Parenthetical: "(text)" on its own line inside a dialogue block.
6. Transition: ">> " + text (e.g. ">> CUT TO:").
7. Centered text: ">> text <<".
8. Lyrics: "~ " at the start of every lyric line.
9. Section/act heading: "# " + text.
10. Emphasis already marked with *italic*, **bold** or _underline_ must be kept.

Line breaks:
- Source scripts are hard-wrapped to a page width (often ~35 characters for dialogue, ~60 for action). Those breaks are layout, not content: the editor re-wraps text for display and print. Rejoin wrapped lines with a single space so each dialogue speech and each action paragraph is one continuous line. Keep hyphens exactly as in the source (never add or remove one).
- Keep a line break inside dialogue or action only where the writer clearly intended one: a blank line inside a speech (a new paragraph of the same speaker) becomes a single newline, without a blank line, keeping it in the same dialogue block; a line that stands alone as a deliberate beat, a list item, a line of verse or a short fragment followed by a new sentence on its own line may stay on its own line. Parentheticals stay on their own lines.
- Decide by meaning: break where the sentence or thought ends and the source shows a deliberate paragraph or beat, never merely because the source line was full.
- Example. Source:
          FARMER (ON TV)
  It just looked like a big black
  cat. Like a normal house cat, but
  really big.

  Big, sharp, kind of jagged teeth.
  My sheep are alright though.
  Output:
  @FARMER (ON TV)
  It just looked like a big black cat. Like a normal house cat, but really big.
  Big, sharp, kind of jagged teeth. My sheep are alright though.

Rules:
- Keep every word of the source, in its original language and script. Never translate, transliterate, summarise, correct, reorder or add text.
- Do not invent scene headings, character names, metadata ("& key: value") or notes.
- Page numbers, "CONTINUED", "(MORE)" and "(CONT'D)" page furniture may be dropped.
- If a line's role is unclear, keep it as action.
- Output only the Sutra text: no explanations, no code fences, no frontmatter.`
