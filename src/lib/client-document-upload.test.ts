import assert from 'node:assert/strict'
import test from 'node:test'
import { MAX_MARKETING_CALL_NOTES_BYTES, validateDocumentUpload } from './client-document-upload.ts'

test('marketing call notes accept PDF, DOCX, and TXT with matching file types', () => {
  assert.equal(validateDocumentUpload('marketing_call_notes', { name: 'notes.pdf', type: 'application/pdf' }), null)
  assert.equal(validateDocumentUpload('marketing_call_notes', { name: 'notes.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), null)
  assert.equal(validateDocumentUpload('marketing_call_notes', { name: 'notes.txt', type: 'text/plain' }), null)
})

test('marketing call notes reject unsupported files and mismatched MIME types', () => {
  assert.match(validateDocumentUpload('marketing_call_notes', { name: 'notes.exe', type: 'application/octet-stream' }) ?? '', /not an accepted file type/i)
  assert.match(validateDocumentUpload('marketing_call_notes', { name: 'notes.pdf', type: 'text/plain' }) ?? '', /not an accepted file type/i)
  assert.equal(MAX_MARKETING_CALL_NOTES_BYTES, 15 * 1024 * 1024)
})
