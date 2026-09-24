import { importDocx, isSutrataDocx, readDocxText } from '../file/docx-importer'

export type ImportSource =
  /** A DOCX exported by Sutrata: imported losslessly, no AI needed. */
  | { kind: 'sutra'; name: string; sutra: string; warnings: string[] }
  /** Anything else: plain text (with emphasis markup) for the AI formatter. */
  | { kind: 'text'; name: string; text: string }

export const IMPORT_ACCEPT = '.docx,.txt,.text,.md,.markdown'

/** Read a picked file for import. Word documents Sutrata wrote keep the lossless importer. */
export async function readImportFile(file: File): Promise<ImportSource> {
  const name = file.name
  if (/\.docx$/i.test(name)) {
    const buffer = await file.arrayBuffer()
    if (await isSutrataDocx(buffer)) {
      const { bodyText, warnings } = await importDocx(buffer)
      return { kind: 'sutra', name, sutra: bodyText ?? '', warnings }
    }
    return { kind: 'text', name, text: await readDocxText(buffer) }
  }
  if (/\.(txt|text|md|markdown)$/i.test(name)) {
    return { kind: 'text', name, text: (await file.text()).replace(/\r\n?/g, '\n').trim() }
  }
  throw new Error(`Unsupported file type: ${name}. Choose a .docx, .txt or .md file.`)
}
