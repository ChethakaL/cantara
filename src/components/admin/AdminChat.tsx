'use client'

import { useState } from 'react'
import { MessageSquare } from 'lucide-react'
import { ChatThread } from '@/components/chat/ChatThread'
import { useChatRoom } from '@/hooks/useChatRoom'

export default function AdminChat({ clientId, clientName, adminName }: {
  clientId: string
  clientName: string
  adminName: string
}) {
  const [draft, setDraft] = useState('')
  const [attachment, setAttachment] = useState<File | null>(null)
  const { messages, unreadCount, sending, sendMessage } = useChatRoom({
    clientId,
    viewer: 'admin',
    senderName: adminName,
    isActive: true,
  })

  const send = async () => {
    if (!draft.trim()) return
    const ok = await sendMessage(draft, attachment)
    if (ok) { setDraft(''); setAttachment(null) }
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Client Messages
            {unreadCount > 0 && (
              <span
                className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold text-white"
                style={{ background: '#ef4444' }}
              >
                {unreadCount}
              </span>
            )}
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">Conversation with {clientName}</p>
        </div>
      </div>

      <ChatThread
        messages={messages}
        viewer="admin"
        draft={draft}
        onDraftChange={setDraft}
        onSend={() => void send()}
        attachment={attachment}
        onAttachmentChange={setAttachment}
        sending={sending}
        emptyHint={`No messages yet. Send a message to ${clientName}.`}
        placeholder={`Reply to ${clientName}...`}
      />
    </div>
  )
}
