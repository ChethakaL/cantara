import test from 'node:test'
import assert from 'node:assert/strict'
import { SalesLeadCallResult, SalesLeadStage } from '@prisma/client'
import {
  addCalendarDays,
  changeStage,
  isIdleLead,
  processDueDate,
  recordCallResult,
  SalesLeadWorkflowError,
  startEmail,
} from './workflow.ts'

const t0 = new Date('2026-08-04T14:00:00.000Z')

function lead(currentStage: SalesLeadStage, overrides: Record<string, unknown> = {}) {
  return {
    currentStage,
    assignedCallerId: 'gabriela-user-id',
    nextActionDate: null,
    bookingDateTime: null,
    ...overrides,
  } as any
}

function apply(current: any, result: { patch: Record<string, unknown> }) {
  return { ...current, ...result.patch }
}

test('T1 - normal no-response path follows Day 0/7/14/21 and queues nurture', () => {
  let current = lead(SalesLeadStage.EMAIL_1_DUE, { nextActionDate: t0 })
  current = apply(current, startEmail(current, 1, t0))
  assert.equal(current.currentStage, SalesLeadStage.EMAIL_1_SENT)
  assert.equal(current.nextActionDate.toISOString(), addCalendarDays(t0, 7).toISOString())

  current = apply(current, processDueDate(current, addCalendarDays(t0, 7))!)
  assert.equal(current.currentStage, SalesLeadStage.CALL_1_DUE)
  current = apply(current, recordCallResult({
    lead: current,
    result: SalesLeadCallResult.NO_ANSWER,
    now: addCalendarDays(t0, 7),
  }))
  assert.equal(current.currentStage, SalesLeadStage.EMAIL_2_DUE)
  assert.equal(current.nextActionDate.toISOString(), addCalendarDays(t0, 14).toISOString())
  assert.throws(
    () => startEmail(current, 2, addCalendarDays(t0, 8)),
    (error: unknown) => error instanceof SalesLeadWorkflowError && error.code === 'EMAIL_NOT_DUE',
  )
  const earlySend = startEmail(current, 2, addCalendarDays(t0, 8), { allowEarlySend: true })
  assert.equal(earlySend.patch.currentStage, SalesLeadStage.EMAIL_2_SENT)

  current = apply(current, startEmail(current, 2, addCalendarDays(t0, 14)))
  assert.equal(current.currentStage, SalesLeadStage.EMAIL_2_SENT)
  assert.equal(current.nextActionDate.toISOString(), addCalendarDays(t0, 21).toISOString())
  current = apply(current, processDueDate(current, addCalendarDays(t0, 21))!)
  assert.equal(current.currentStage, SalesLeadStage.CALL_2_DUE)
  const finalResult = recordCallResult({
    lead: current,
    result: SalesLeadCallResult.LEFT_VOICEMAIL,
    now: addCalendarDays(t0, 21),
  })
  current = apply(current, finalResult)
  assert.equal(current.currentStage, SalesLeadStage.COMPLETED_NO_RESPONSE)
  assert.equal(current.nextActionDate, null)
  assert.deepEqual(finalResult.effects.find(effect => effect.type === 'HANDOFF'), {
    type: 'HANDOFF',
    destination: 'NURTURE',
  })
})

test('T2 - booked after Email 1 stops the sequence and queues Deals/CRM handoff', () => {
  const bookingDateTime = addCalendarDays(t0, 2)
  const result = changeStage({
    lead: lead(SalesLeadStage.EMAIL_1_SENT, { nextActionDate: addCalendarDays(t0, 7) }),
    stage: SalesLeadStage.BOOKED,
    bookingDateTime,
  })
  const booked = apply(lead(SalesLeadStage.EMAIL_1_SENT), result)
  assert.equal(booked.currentStage, SalesLeadStage.BOOKED)
  assert.equal(booked.nextActionDate, null)
  assert.equal(processDueDate(booked, addCalendarDays(t0, 30)), null)
  assert.deepEqual(result.effects.find(effect => effect.type === 'HANDOFF'), {
    type: 'HANDOFF',
    destination: 'DEALS_CRM',
  })
})

test('T3 - callback after Call 1 pauses the standard sequence', () => {
  const callbackDate = addCalendarDays(t0, 3)
  const result = recordCallResult({
    lead: lead(SalesLeadStage.CALL_1_DUE),
    result: SalesLeadCallResult.CALLBACK_REQUESTED,
    disposition: SalesLeadStage.NEEDS_FOLLOW_UP,
    callbackDate,
    now: t0,
  })
  const callback = apply(lead(SalesLeadStage.CALL_1_DUE), result)
  assert.equal(callback.currentStage, SalesLeadStage.NEEDS_FOLLOW_UP)
  assert.equal(callback.nextActionDate.toISOString(), callbackDate.toISOString())
  assert.equal(processDueDate(callback, addCalendarDays(t0, 20)), null)
})

test('T4 - not interested stops sequence and queues nurture handoff', () => {
  const result = changeStage({
    lead: lead(SalesLeadStage.CALL_1_DUE),
    stage: SalesLeadStage.NOT_INTERESTED_TO_NURTURE,
  })
  assert.equal(result.patch.nextActionDate, null)
  assert.deepEqual(result.effects.find(effect => effect.type === 'HANDOFF'), {
    type: 'HANDOFF',
    destination: 'NURTURE',
  })
})

test('T5 - active lead idle for more than 10 calendar days is identified', () => {
  assert.equal(isIdleLead(addCalendarDays(t0, -11), t0), true)
  assert.equal(isIdleLead(addCalendarDays(t0, -10), t0), false)
  assert.equal(isIdleLead(null, t0), false)
})

test('T6 - terminal stages do not advance or restart implicitly', () => {
  for (const stage of [SalesLeadStage.OPTED_OUT, SalesLeadStage.BAD_CONTACT, SalesLeadStage.CLOSED_SOLD]) {
    const terminal = lead(stage, { nextActionDate: addCalendarDays(t0, -1) })
    assert.equal(processDueDate(terminal, t0), null)
    assert.throws(
      () => changeStage({ lead: terminal, stage: SalesLeadStage.EMAIL_1_DUE, nextActionDate: t0 }),
      (error: unknown) =>
        error instanceof SalesLeadWorkflowError && error.code === 'TERMINAL_STAGE_PROTECTED',
    )
  }
})

test('T7 - caller assignment remains unchanged through both calls', () => {
  let current = lead(SalesLeadStage.CALL_1_DUE)
  current = apply(current, recordCallResult({
    lead: current,
    result: SalesLeadCallResult.NO_ANSWER,
    now: t0,
  }))
  assert.equal(current.assignedCallerId, 'gabriela-user-id')
  current = apply(current, startEmail(current, 2, addCalendarDays(t0, 7)))
  current = apply(current, processDueDate(current, addCalendarDays(t0, 14))!)
  current = apply(current, recordCallResult({
    lead: current,
    result: SalesLeadCallResult.NO_ANSWER,
    now: addCalendarDays(t0, 14),
  }))
  assert.equal(current.assignedCallerId, 'gabriela-user-id')
})

test('Call result requires an assigned caller', () => {
  assert.throws(
    () => recordCallResult({
      lead: lead(SalesLeadStage.CALL_1_DUE, { assignedCallerId: null }),
      result: SalesLeadCallResult.NO_ANSWER,
      now: t0,
    }),
    (error: unknown) => error instanceof SalesLeadWorkflowError && error.code === 'CALLER_REQUIRED',
  )
})

test('automation-owned active stage transitions cannot be skipped manually', () => {
  assert.throws(
    () => changeStage({
      lead: lead(SalesLeadStage.EMAIL_1_SENT),
      stage: SalesLeadStage.EMAIL_2_DUE,
      nextActionDate: addCalendarDays(t0, 7),
    }),
    (error: unknown) =>
      error instanceof SalesLeadWorkflowError && error.code === 'AUTOMATION_OWNED_TRANSITION',
  )
})
