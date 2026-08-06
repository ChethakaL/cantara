export type SalesLeadListItem = {
  id: string
  businessName: string
  currentStage: string
  lastCallResult: string | null
  nextActionDate: string | null
  stageStartDate: string | null
  lastContactDate: string | null
  city: string | null
  state: string | null
  ownerPhone: string | null
  ownerEmail: string | null
  phoneType: string
  emailType: string
  assignedCaller: { id: string; name: string; email: string } | null
  mondayItemId: string | null
  syncStatus: string
}
