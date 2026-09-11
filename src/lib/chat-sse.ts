/**
 * Shared, visibility-aware EventSource for chat live updates.
 * Multiple hooks/components on the same page (and duplicate admin-inbox
 * subscribers) share one connection per URL. Hidden tabs close streams so
 * multi-tab local dev does not starve the Next.js request pool.
 */

type UpdateHandler = (event: MessageEvent) => void

type Channel = {
  url: string
  source: EventSource | null
  updates: Set<UpdateHandler>
  opens: Set<() => void>
  errors: Set<() => void>
}

const channels = new Map<string, Channel>()
let visibilityBound = false

function ensureVisibilityBinding() {
  if (visibilityBound || typeof document === 'undefined') return
  visibilityBound = true
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      for (const channel of Array.from(channels.values())) closeSource(channel)
    } else {
      for (const channel of Array.from(channels.values())) {
        if (channel.updates.size > 0) openSource(channel)
      }
    }
  })
}

function openSource(channel: Channel) {
  if (typeof window === 'undefined') return
  if (channel.source) return
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return

  const source = new EventSource(channel.url)
  channel.source = source

  source.addEventListener('update', event => {
    for (const handler of Array.from(channel.updates)) handler(event as MessageEvent)
  })
  source.addEventListener('open', () => {
    for (const handler of Array.from(channel.opens)) handler()
  })
  source.onerror = () => {
    for (const handler of Array.from(channel.errors)) handler()
  }
}

function closeSource(channel: Channel) {
  if (!channel.source) return
  channel.source.close()
  channel.source = null
}

export function subscribeChatSse(
  url: string,
  onUpdate: UpdateHandler,
  options?: { onOpen?: () => void; onError?: () => void },
): () => void {
  ensureVisibilityBinding()

  let channel = channels.get(url)
  if (!channel) {
    channel = { url, source: null, updates: new Set(), opens: new Set(), errors: new Set() }
    channels.set(url, channel)
  }

  channel.updates.add(onUpdate)
  if (options?.onOpen) channel.opens.add(options.onOpen)
  if (options?.onError) channel.errors.add(options.onError)

  openSource(channel)

  return () => {
    channel!.updates.delete(onUpdate)
    if (options?.onOpen) channel!.opens.delete(options.onOpen)
    if (options?.onError) channel!.errors.delete(options.onError)

    if (channel!.updates.size === 0) {
      closeSource(channel!)
      channels.delete(url)
    }
  }
}
