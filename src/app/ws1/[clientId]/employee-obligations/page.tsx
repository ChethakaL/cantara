'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import EmployeeObligationsTab from '@/components/ws1-6/EmployeeObligationsTab'
import { getClient, type Client } from '@/lib/store'

export default function WS16ReportPage() {
  const params = useParams()
  const clientId = params.clientId as string
  const [client, setClient] = useState<Client | null>(null)

  useEffect(() => {
    void getClient(clientId).then(setClient)
  }, [clientId])

  return (
    <div className="min-h-screen bg-stone-50 font-sans p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <EmployeeObligationsTab 
          clientId={clientId} 
          clientName={client?.company || client?.name || 'Client Name'} 
          state={client?.state || 'Unknown'}
          dba={client?.dba || undefined}
          totalEmployeesSelfReported={client?.totalEmployeesSelfReported ?? undefined}
          employmentTypeBreakdown={client?.employmentTypeBreakdown ?? undefined}
        />
      </div>
    </div>
  )
}
