'use client'

import TopCompetitorsForm from '@/components/competitor-analysis/TopCompetitorsForm'
import { readCompetitorSlots, writeCompetitorSlots } from '@/lib/competitor-portal-form'
import type { ManualCompetitorEntry } from '@/lib/competitor-analysis/types'
import type { ClientPortalFormQuestion } from '@/app/dashboard/page'

function isCompetitorSlotField(fieldKey: string): boolean {
  return /^competitor\d+(Name|Website|Address|Category)$/.test(fieldKey) || fieldKey === 'competitorSlotCount'
}

type FormQuestionFieldsProps = {
  questions: ClientPortalFormQuestion[]
  formResponses: Record<string, string>
  onUpdate: (fieldKey: string, value: string) => void
  onError: (message: string) => void
}

export function ClientCompetitorInputsFields({
  mode,
  questions,
  formResponses,
  onUpdate,
  onCompetitorsChange,
  FormQuestionFields,
  onError,
  showTopCompetitors = true,
}: {
  mode: 'competitor_analysis' | 'pricing_analysis'
  questions: ClientPortalFormQuestion[]
  formResponses: Record<string, string>
  onUpdate: (fieldKey: string, value: string) => void
  onCompetitorsChange: (responses: Record<string, string>) => void
  onError: (message: string) => void
  FormQuestionFields: React.ComponentType<FormQuestionFieldsProps>
  showTopCompetitors?: boolean
}) {
  const businessQuestions = questions.filter(question => !isCompetitorSlotField(question.fieldKey))
  const competitors = readCompetitorSlots(formResponses)

  const handleCompetitorsChange = (nextCompetitors: ManualCompetitorEntry[]) => {
    onCompetitorsChange(writeCompetitorSlots(formResponses, nextCompetitors))
  }

  return (
    <div className="space-y-5">
      {businessQuestions.length > 0 && (
        <FormQuestionFields
          questions={businessQuestions}
          formResponses={formResponses}
          onUpdate={onUpdate}
          onError={onError}
        />
      )}
      {showTopCompetitors && (
        <TopCompetitorsForm
          competitors={competitors}
          onChange={handleCompetitorsChange}
          showAddress={mode === 'competitor_analysis'}
          addressRequired={false}
          allowAddRemove={false}
        />
      )}
    </div>
  )
}
