import type { StorageAdapter } from '@sutrata/editor'
import {
  saveDocument, loadDocument, listVersions, saveStyle, loadAllStyles, deleteStyle,
  saveFileHandle, loadFileHandle, deleteAllVersions,
} from './file/storage'
import { openFileFromDisk, openDocxFromDisk, openStyleJsonFromDisk, saveFileToDisk } from './file/file-access'

/** Format spec §3.2: autosave goes to IndexedDB on web, disk on desktop. The
 *  Tauri shell exposes window.desktopAPI.autosaveWrite/Read for the disk path;
 *  fall back to IndexedDB when it's absent (a plain web build, or an older
 *  desktop build without it). Version history stays IndexedDB-only either way. */
async function saveDocumentAdaptive(path: string, content: string): Promise<void> {
  const desktop = window.desktopAPI
  if (desktop?.autosaveWrite) {
    await desktop.autosaveWrite(path, content)
    return
  }
  await saveDocument(path, content)
}

async function loadDocumentAdaptive(path: string): Promise<string | null> {
  const desktop = window.desktopAPI
  if (desktop?.autosaveRead) {
    return desktop.autosaveRead(path)
  }
  return loadDocument(path)
}

/** The OSS app's default StorageAdapter (OSS spec §11.5): IndexedDB (or, on the
 *  Tauri desktop build, disk) for document persistence, IndexedDB for version
 *  history and remembered file handles, and the File System Access API (with
 *  <input> fallback) for user-facing open/save. Sutrata Cloud supplies a
 *  different implementation of the same interface. */
async function saveFileToDiskWithVersion(
  name: string,
  content: string,
  existingHandle?: unknown,
): Promise<{ savedName: string; handle: unknown } | null> {
  const result = await saveFileToDisk(name, content, existingHandle as Parameters<typeof saveFileToDisk>[2])
  if (result) {
    // Create a version entry for this explicit save
    await saveDocument(result.savedName, content)
  }
  return result
}

export const localStorageAdapter: StorageAdapter = {
  saveDocument: saveDocumentAdaptive,
  loadDocument: loadDocumentAdaptive,
  listVersions,
  saveStyle,
  loadAllStyles,
  deleteStyle,
  openFile: openFileFromDisk,
  openDocx: openDocxFromDisk,
  openStyleJson: openStyleJsonFromDisk,
  saveFile: saveFileToDiskWithVersion,
  persistFileHandle: saveFileHandle,
  restoreFileHandle: loadFileHandle,
  deleteAllVersions,
}
