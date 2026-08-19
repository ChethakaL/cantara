import test from 'node:test'
import assert from 'node:assert/strict'
import { calendarEventMatchesLead, collectMatchingCalendarEvents } from './calendar-match.ts'

const lead = {
  businessName: 'Sit! Stay! Play!',
  ownerFirstName: 'Janet',
  ownerLastName: 'Galante',
  ownerEmail: 'janet@sitstayplaytucson.com',
  nextActionDate: '2026-08-26T06:45:10.993Z',
}

test('calendar match prefers owner email on the invite', () => {
  const result = calendarEventMatchesLead({
    id: 'evt-1',
    summary: 'Intro call',
    start: { dateTime: '2026-08-20T16:00:00Z' },
    attendees: [{ email: 'janet@sitstayplaytucson.com', displayName: 'Janet' }],
  }, lead)
  assert.equal(result.matched, true)
  assert.match(result.reason, /email/i)
})

test('calendar match uses business name and next-stage date with last name', () => {
  const byName = calendarEventMatchesLead({
    id: 'evt-2',
    summary: 'Sit! Stay! Play! follow-up',
    start: { dateTime: '2026-09-01T16:00:00Z' },
  }, lead)
  assert.equal(byName.matched, true)

  const byDateAndLast = calendarEventMatchesLead({
    id: 'evt-3',
    summary: 'Call with Galante',
    start: { dateTime: '2026-08-26T15:00:00Z' },
  }, lead)
  assert.equal(byDateAndLast.matched, true)
})

test('unrelated calendar events are ignored', () => {
  const result = calendarEventMatchesLead({
    id: 'evt-4',
    summary: 'Dentist',
    start: { dateTime: '2026-08-26T15:00:00Z' },
  }, lead)
  assert.equal(result.matched, false)
})

test('matching events are de-duplicated', () => {
  const events = collectMatchingCalendarEvents([
    { items: [{ id: 'evt-1', summary: 'Sit! Stay! Play!', start: { dateTime: '2026-08-26T15:00:00Z' } }] },
    { items: [{ id: 'evt-1', summary: 'Sit! Stay! Play!', start: { dateTime: '2026-08-26T15:00:00Z' } }] },
  ], lead)
  assert.equal(events.length, 1)
  assert.equal(events[0].id, 'evt-1')
})
