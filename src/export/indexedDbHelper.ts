/**
 * Shared IndexedDB helper — eliminates boilerplate across stores.
 */

export function createStore(dbName: string, storeName: string, version = 1) {
  function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(dbName, version)
      req.onupgradeneeded = () => {
        req.result.createObjectStore(storeName)
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }

  async function save<T>(key: string, value: T): Promise<void> {
    const db = await openDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite')
      tx.objectStore(storeName).put(value, key)
      tx.oncomplete = () => { db.close(); resolve() }
      tx.onerror = () => { db.close(); reject(tx.error) }
    })
  }

  async function load<T>(key: string): Promise<T | null> {
    try {
      const db = await openDb()
      const result = await new Promise<T | undefined>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly')
        const req = tx.objectStore(storeName).get(key)
        req.onsuccess = () => { db.close(); resolve(req.result as T | undefined) }
        req.onerror = () => { db.close(); reject(req.error) }
      })
      return result ?? null
    } catch {
      return null
    }
  }

  return { save, load }
}
