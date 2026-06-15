import type { Client } from '@/lib/store'
import { getClients } from '@/lib/store'

export async function resolveClientSession(): Promise<{ client: Client | null; sessionEmail: string }> {
  const email = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('cantara_client_email') || 'null') : null
  const clientId = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('cantara_client_id') || 'null') : null
  const sessionEmail = email || ''
  const all = await getClients()
  const client =
    (clientId ? all.find(c => c.id === clientId) : null) ??
    (email ? all.find(c => c.email === email || c.teamMembers.some(member => member.email === email)) : null) ??
    all.find(c => c.workstream) ??
    all[0] ??
    null
  return { client, sessionEmail }
}
