/** Unicode block ranges for the complex scripts Sutrata recognizes, keyed by the same
 *  lang codes used throughout (docx-exporter.ts's SCRIPT_FONT_BY_LANG, types.ts's
 *  COMPLEX_SCRIPT_CODES, complexScriptFontOverrides / italicScripts). Shared so
 *  docx-exporter.ts (font override) and workflow-reports.ts (forced-italic wrapping in the
 *  print/PDF HTML) test the same ranges rather than maintaining two copies that could drift. */
export const SCRIPT_UNICODE_RANGES: Record<string, RegExp> = {
  hi: /[ऀ-ॿ]/,
  ta: /[஀-௿]/,
  te: /[ఀ-౿]/,
  kn: /[ಀ-೿]/,
  ml: /[ഀ-ൿ]/,
  bn: /[ঀ-৿]/,
  gu: /[઀-૿]/,
  pa: /[਀-੿]/,
  or: /[଀-୿]/,
  si: /[඀-෿]/,
}
