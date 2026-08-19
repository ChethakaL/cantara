import test from 'node:test'
import assert from 'node:assert/strict'
import { matchMondayPersonName } from './caller-match.ts'

const callers = [
  { id: 'admin-craig-cantara', name: 'Craig', email: 'craig@cantarapet.com' },
  { id: 'admin-gabriela-cantara', name: 'Gabriela', email: 'gabriela@cantarapet.com' },
  { id: 'admin-personal', name: 'Admin', email: 'chethaka.sl@gmail.com' },
  { id: 'admin-1', name: 'Cantara Admin', email: 'admin@cantara.demo' },
]

test('Craig Pollack matches Craig, not Admin', () => {
  const match = matchMondayPersonName('Craig Pollack', callers)
  assert.equal(match?.id, 'admin-craig-cantara')
})

test('match is case-insensitive like ILIKE', () => {
  const match = matchMondayPersonName('  craig pollack  ', callers)
  assert.equal(match?.id, 'admin-craig-cantara')
})

test('Gabriela Torres matches Gabriela', () => {
  const match = matchMondayPersonName('Gabriela Torres', callers)
  assert.equal(match?.id, 'admin-gabriela-cantara')
})

test('empty people cell matches nobody', () => {
  assert.equal(matchMondayPersonName('', callers), null)
})

test('unknown monday name does not steal another admin', () => {
  assert.equal(matchMondayPersonName('Stephanie Brooks', callers), null)
})
