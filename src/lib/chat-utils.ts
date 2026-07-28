import type { ChatMessage } from '@/lib/store'

export type ChatViewerRole = 'admin' | 'client'

export function normalizeSenderRole(role: string): 'admin' | 'client' {
  return role?.toLowerCase() === 'admin' ? 'admin' : 'client'
}

export function mapChatMessage(row: {
  id: string
  clientId: string
  senderRole: string
  senderName: string
  message: string
  timestamp: Date | string
  readByAdmin: boolean
  readByClient: boolean
  attachmentUrl?: string | null
  attachmentName?: string | null
  attachmentMimeType?: string | null
  attachmentSize?: number | null
}): ChatMessage {
  return {
    id: row.id,
    clientId: row.clientId,
    senderRole: normalizeSenderRole(row.senderRole),
    senderName: row.senderName,
    message: row.message,
    timestamp: typeof row.timestamp === 'string' ? row.timestamp : row.timestamp.toISOString(),
    readByAdmin: row.readByAdmin,
    readByClient: row.readByClient,
    attachmentUrl: row.attachmentUrl,
    attachmentName: row.attachmentName,
    attachmentMimeType: row.attachmentMimeType,
    attachmentSize: row.attachmentSize,
  }
}

export function isOwnMessage(message: ChatMessage, viewer: ChatViewerRole) {
  return normalizeSenderRole(message.senderRole) === viewer
}

export function countUnreadForViewer(messages: ChatMessage[], viewer: ChatViewerRole) {
  return messages.filter(message => {
    if (viewer === 'admin') {
      return normalizeSenderRole(message.senderRole) === 'client' && !message.readByAdmin
    }
    return normalizeSenderRole(message.senderRole) === 'admin' && !message.readByClient
  }).length
}
