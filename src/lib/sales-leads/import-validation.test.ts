import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeImportRow, validateImportRows } from './import-validation.ts'

test('qualified independent boarding lead passes admission criteria', () => {
  const row = normalizeImportRow({
    'Business Name': 'Desert Paws Resort',
    'Independent Operator': 'Yes',
    Services: 'Boarding, daycare and grooming',
    'Google Rating': 4.8,
    'Review Count': 175,
  }, 2)
  const [validated] = validateImportRows([row])
  assert.equal(validated.qualified, true)
  assert.deepEqual(validated.errors, [])
})

test('unqualified, grooming-only, low-rating, and duplicate leads are rejected', () => {
  const row = normalizeImportRow({
    'Business Name': 'Chain Grooming',
    'Independent Operator': 'No',
    Services: 'Grooming',
    'Google Rating': 4.2,
    'Review Count': 12,
  }, 2)
  const [validated] = validateImportRows([row, { ...row, rowNumber: 3 }])
  assert.equal(validated.qualified, false)
  assert.ok(validated.errors.length >= 4)
})
