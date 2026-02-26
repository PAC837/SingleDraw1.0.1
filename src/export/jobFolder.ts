/**
 * Job folder integration using the File System Access API.
 * Allows writing DES + BAK files directly to a Mozaik job folder.
 */

/** Prompt user to select the job folder (grants read/write access). */
export async function pickJobFolder(): Promise<FileSystemDirectoryHandle> {
  return await window.showDirectoryPicker({ mode: 'readwrite' })
}

/** Scan the folder for existing RoomN.des files and return the next number. */
export async function findNextRoomNumber(dir: FileSystemDirectoryHandle): Promise<number> {
  let max = -1
  for await (const entry of dir.values()) {
    const match = entry.name.match(/^Room(\d+)\.des$/i)
    if (match) max = Math.max(max, parseInt(match[1], 10))
  }
  return max + 1
}

/**
 * Write a DES file and its BAK companion to the job folder.
 * Mozaik requires the BAK file or it will crash on load.
 * Returns the DES filename that was written.
 */
export async function exportDesRoom(
  dir: FileSystemDirectoryHandle,
  content: string,
  roomNumber: number,
): Promise<string> {
  const desName = `Room${roomNumber}.des`
  const bakName = `Room${roomNumber}.bak`

  // Write .des file
  const desHandle = await dir.getFileHandle(desName, { create: true })
  const desWritable = await desHandle.createWritable()
  await desWritable.write(content)
  await desWritable.close()

  // Write .bak file (same content — Mozaik requires this)
  const bakHandle = await dir.getFileHandle(bakName, { create: true })
  const bakWritable = await bakHandle.createWritable()
  await bakWritable.write(content)
  await bakWritable.close()

  console.log(`[EXPORT] Wrote ${desName} + ${bakName} to job folder`)
  return desName
}
