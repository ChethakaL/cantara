import assert from 'node:assert/strict'
import test from 'node:test'
import {
  BUYER_FOLLOW_UP_GUIDANCE_POINTS,
  splitMarketingAssessmentPoints,
} from './marketing-assessment-display.ts'

test('splits paragraph advisor assessment into readable points', () => {
  const points = splitMarketingAssessmentPoints(
    'The owner reported Google Ads spend of about $900 per month. No channel dashboard was provided. Local search results showed a rank-1 Maps result.',
  )
  assert.equal(points.length, 3)
  assert.match(points[0], /Google Ads spend/)
  assert.match(points[1], /channel dashboard/)
  assert.match(points[2], /rank-1 Maps/)
})

test('keeps explicit bullet lines from newer model output', () => {
  const points = splitMarketingAssessmentPoints(
    '- Spend was about $900/month from Google Ads.\n- Referral estimate was $8,415 from Cedar Creek.\n- No email program was reported.',
  )
  assert.deepEqual(points, [
    'Spend was about $900/month from Google Ads.',
    'Referral estimate was $8,415 from Cedar Creek.',
    'No email program was reported.',
  ])
})

test('rewrites research labels in assessment points', () => {
  const points = splitMarketingAssessmentPoints(
    'DataForSEO showed rank 1. Google PageSpeed Insights was mixed.',
  )
  assert.match(points[0], /local search results/)
  assert.match(points[1], /website speed test/)
})

test('buyer follow-up guidance stays as short points', () => {
  assert.ok(BUYER_FOLLOW_UP_GUIDANCE_POINTS.length >= 3)
})
