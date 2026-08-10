import type { Client } from '@/lib/store'
import { getClient, getClients } from '@/lib/store'

export async function resolveClientSession(): Promise<{ client: Client | null; sessionEmail: string }> {
  const email = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('cantara_client_email') || 'null') : null
  const clientId = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('cantara_client_id') || 'null') : null
  const sessionEmail = email || ''

  // Prefer the full detail endpoint — list /api/clients is summary-only.
  if (clientId) {
    const byId = await getClient(clientId)
    if (byId) return { client: byId, sessionEmail }
  }

  const all = await getClients()
  const match =
    (email ? all.find(c => c.email === email || c.teamMembers.some(member => member.email === email)) : null) ??
    all.find(c => c.workstream) ??
    all[0] ??
    null

  if (!match) return { client: null, sessionEmail }

  const full = await getClient(match.id)
  return { client: full ?? match, sessionEmail }
}
