import { NextRequest } from 'next/server'
import { subscribeChatChannel } from '@/lib/chat-bus'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get('clientId')
  const scope = req.nextUrl.searchParams.get('scope')

  if (scope !== 'admin-inbox' && !clientId) {
    return new Response('clientId or scope=admin-inbox required', { status: 400 })
  }

  const channel = scope === 'admin-inbox' ? 'admin-inbox' : `client:${clientId}`
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      const send = (payload: object) => {
        controller.enqueue(encoder.encode(`event: update\ndata: ${JSON.stringify(payload)}\n\n`))
      }

      send({ type: 'connected', channel })

      const unsubscribe = subscribeChatChannel(channel, event => {
        send(event)
      })

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': ping\n\n'))
        } catch {
          clearInterval(heartbeat)
        }
      }, 25000)

      req.signal.addEventListener('abort', () => {
        clearInterval(heartbeat)
        unsubscribe()
        try {
          controller.close()
        } catch {
          /* already closed */
        }
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
