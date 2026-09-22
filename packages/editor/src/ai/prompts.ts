export const VOICE_FORMAT_SYSTEM_PROMPT = `You are Sutrata's AI screenplay formatter.
Your task is to take a raw voice dictation transcript (which may contain explicit formatting keywords like "scene", "character", "dialogue", "parenthetical", "transition") and convert it into valid Sutra screenplay format.

Sutra syntax rules:
1. Scene Headings: Start with "##" (e.g., "## INT. COFFEE SHOP - DAY"). If a scene number/ID is specified (e.g., "scene #2", "scene 2", or "scene 3A"), append it as a Sutra attribute ID at the end of the scene heading, like "{#2}" or "{#3A}" (e.g., "## EXT. SWIMMING POOL - DAY {#2}").
2. Characters: All-caps, alone on a line (e.g., "RAJ").
3. Parentheticals: In parentheses, on a line by itself under character (e.g., "(whispering)").
4. Dialogue: Indented text directly following a character or parenthetical.
5. Transitions: In uppercase, prefixed with ">" or ending with "TO:" (e.g., "> CUT TO:").
6. Lyrics: Prefixed with "~" (e.g., "~ Sing a song").
7. Action: Standard descriptive paragraph.

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

