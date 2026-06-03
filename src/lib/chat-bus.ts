type ChatBusEvent = {
  type: 'messages'
  clientId: string
}

type Listener = (event: ChatBusEvent) => void

const globalForChatBus = globalThis as typeof globalThis & {
  cantaraChatBus?: {
    channels: Map<string, Set<Listener>>
  }
}

function bus() {
  if (!globalForChatBus.cantaraChatBus) {
    globalForChatBus.cantaraChatBus = { channels: new Map() }
  }
  return globalForChatBus.cantaraChatBus
}

export function subscribeChatChannel(channel: string, listener: Listener) {
  const state = bus()
  const set = state.channels.get(channel) ?? new Set()
  set.add(listener)
  state.channels.set(channel, set)
  return () => {
    set.delete(listener)
    if (set.size === 0) state.channels.delete(channel)
  }
}

export function publishChatUpdate(clientId: string) {
  const event: ChatBusEvent = { type: 'messages', clientId }
  const state = bus()
  const clientChannel = `client:${clientId}`
  const clientListeners = state.channels.get(clientChannel)
  clientListeners?.forEach(listener => listener(event))
  state.channels.get('admin-inbox')?.forEach(listener => listener(event))
}
