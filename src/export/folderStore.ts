/**
 * IndexedDB persistence for FileSystemDirectoryHandle objects.
 * Allows texture folder and job folder to survive page refreshes.
 */

const DB_NAME = 'singledraw-folders'
const STORE_NAME = 'handles'
const DB_VERSION = 1

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/** Save a FileSystemDirectoryHandle to IndexedDB under the given key. */
export async function saveFolderHandle(key: string, handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(handle, key)
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

/**
 * Load a FileSystemDirectoryHandle from IndexedDB.
 * Returns null if not found or if permission is denied.
 * Will prompt the user for permission if the handle exists.
 */
export async function loadFolderHandle(key: string): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openDb()
    const handle = await new Promise<FileSystemDirectoryHandle | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).get(key)
      req.onsuccess = () => { db.close(); resolve(req.result as FileSystemDirectoryHandle | undefined) }
      req.onerror = () => { db.close(); reject(req.error) }
    })
    if (!handle) return null

    // Re-request permission — browser may show a prompt
    const perm = await handle.requestPermission({ mode: 'read' })
    if (perm !== 'granted') return null

    return handle
  } catch {
    return null
  }
}
