/**
 * IndexedDB persistence for FileSystemDirectoryHandle objects.
 * Allows texture folder and job folder to survive page refreshes.
 */

import { createStore } from './indexedDbHelper'

const { save, load } = createStore('singledraw-folders', 'handles')

/** Save a FileSystemDirectoryHandle to IndexedDB under the given key. */
export async function saveFolderHandle(key: string, handle: FileSystemDirectoryHandle): Promise<void> {
  await save(key, handle)
}

/**
 * Load a FileSystemDirectoryHandle from IndexedDB.
 * Returns null if not found or if permission is denied.
 * Will prompt the user for permission if the handle exists.
 */
export async function loadFolderHandle(key: string): Promise<FileSystemDirectoryHandle | null> {
  const handle = await load<FileSystemDirectoryHandle>(key)
  if (!handle) return null
  try {
    const perm = await handle.requestPermission({ mode: 'read' })
    if (perm !== 'granted') return null
    return handle
  } catch {
    return null
  }
}
