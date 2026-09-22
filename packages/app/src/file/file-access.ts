/**
 * File System Access API wrappers with <input> fallback for browsers
 * that don't support showOpenFilePicker / showSaveFilePicker (Firefox, older Safari).
 */

const CINE_OPTS = {
  types: [
    { description: 'Sutra screenplay', accept: { 'text/plain': ['.sutra', '.txt'] } },
    { description: 'Fountain screenplay', accept: { 'text/plain': ['.fountain'] } },
  ],
}

export type FSHandle = FileSystemFileHandle & { createWritable(): Promise<FileSystemWritableFileStream> }

export async function openFileFromDisk(): Promise<{ name: string; content: string; handle: FSHandle | null } | null> {
  // Modern API
  if ('showOpenFilePicker' in window) {
    try {
      const handles = await (window as Window & typeof globalThis & {
        showOpenFilePicker: (opts: unknown) => Promise<FSHandle[]>
      }).showOpenFilePicker({ ...CINE_OPTS, multiple: false })
      const handle = handles[0]
      if (!handle) return null
      const file = await handle.getFile()
      const content = await file.text()
      return { name: file.name, content, handle }
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return null
      throw e
    }
  }

  // Fallback: hidden <input type="file">
  return new Promise(resolve => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.sutra,.txt,.fountain'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) { resolve(null); return }
      const content = await file.text()
      resolve({ name: file.name, content, handle: null })
    }
    input.oncancel = () => resolve(null)
    input.click()
  })
}

const DOCX_OPTS = {
  types: [
    { description: 'Word document', accept: { 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'] } },
  ],
}

/** Opens a file picker restricted to .docx, returning the raw bytes for docx-importer.ts to parse. */
export async function openDocxFromDisk(): Promise<{ name: string; buffer: ArrayBuffer } | null> {
  if ('showOpenFilePicker' in window) {
    try {
      const handles = await (window as Window & typeof globalThis & {
        showOpenFilePicker: (opts: unknown) => Promise<FSHandle[]>
      }).showOpenFilePicker({ ...DOCX_OPTS, multiple: false })
      const handle = handles[0]
      if (!handle) return null
      const file = await handle.getFile()
      const buffer = await file.arrayBuffer()
      return { name: file.name, buffer }
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return null
      throw e
    }
  }

  return new Promise(resolve => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.docx'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) { resolve(null); return }
      const buffer = await file.arrayBuffer()
      resolve({ name: file.name, buffer })
    }
    input.oncancel = () => resolve(null)
    input.click()
  })
}

const STYLE_JSON_OPTS = {
  types: [
    { description: 'Sutrata style', accept: { 'application/json': ['.json'] } },
  ],
}

/** Opens a file picker restricted to .json, for importing a custom screenplay style
 *  (see styles/validate.ts for the shape it must match). Mirrors openDocxFromDisk(). */
export async function openStyleJsonFromDisk(): Promise<{ name: string; text: string } | null> {
  if ('showOpenFilePicker' in window) {
    try {
      const handles = await (window as Window & typeof globalThis & {
        showOpenFilePicker: (opts: unknown) => Promise<FSHandle[]>
      }).showOpenFilePicker({ ...STYLE_JSON_OPTS, multiple: false })
      const handle = handles[0]
      if (!handle) return null
      const file = await handle.getFile()
      const text = await file.text()
      return { name: file.name, text }
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return null
      throw e
    }
  }

  return new Promise(resolve => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) { resolve(null); return }
      const text = await file.text()
      resolve({ name: file.name, text })
    }
    input.oncancel = () => resolve(null)
    input.click()
  })
}

/**
 * Save content to disk. If `existingHandle` is provided (file was previously opened or saved
 * via the File System Access API), writes in-place without showing a picker. Otherwise shows
 * the Save As picker and returns a new handle alongside the saved name.
 */
export async function saveFileToDisk(
  name: string,
  content: string,
  existingHandle?: FSHandle | null,
): Promise<{ savedName: string; handle: FSHandle } | null> {
  // Modern API
  if ('showSaveFilePicker' in window || existingHandle) {
    try {
      let handle: FSHandle
      if (existingHandle) {
        handle = existingHandle
      } else {
        handle = await (window as Window & typeof globalThis & {
          showSaveFilePicker: (opts: unknown) => Promise<FSHandle>
        }).showSaveFilePicker({
          ...CINE_OPTS,
          suggestedName: name.endsWith('.sutra') ? name : `${name}.sutra`,
        })
      }
      const writable = await handle.createWritable()
      await writable.write(content)
      await writable.close()
      return { savedName: handle.name, handle }
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return null
      throw e
    }
  }

  // Fallback: trigger download (no handle available in this path)
  const blob = new Blob([content], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name.endsWith('.sutra') ? name : `${name}.sutra`
  a.click()
  URL.revokeObjectURL(url)
  return null
}
