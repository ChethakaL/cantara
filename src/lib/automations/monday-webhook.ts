/** Shared helpers for Monday → Cantara webhook routes. */

export function extractMondayPulseId(body: any): string {
  return String(
    body?.event?.pulseId || body?.event?.itemId || body?.pulseId || body?.itemId || ''
  ).trim()
}

export function extractMondayBoardId(body: any): string {
  return String(
    body?.event?.boardId || body?.boardId || body?.event?.board_id || ''
  ).trim()
}

export function createBackgroundQueue(label: string) {
  let queue: Promise<void> = Promise.resolve()
  return function enqueue(work: () => Promise<void>) {
    queue = queue.then(work).catch(error => {
      console.error(`[${label}] background failed:`, error)
    })
  }
}
