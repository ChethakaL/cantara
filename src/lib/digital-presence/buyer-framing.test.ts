import assert from 'node:assert/strict'
import test from 'node:test'
import {
  BUYER_OPPORTUNITY_FLAG_RULE,
  BUYER_OPPORTUNITY_FRAMING_SECTION,
} from './buyer-opportunity-framing.ts'

test('buyer framing describes SEO/AEO gaps as growth opportunities, not seller failures', () => {
  assert.match(BUYER_OPPORTUNITY_FRAMING_SECTION, /Buyer-Oriented Opportunity Framing/)
  assert.match(BUYER_OPPORTUNITY_FRAMING_SECTION, /potential growth or value-add opportunity for a buyer/i)
  assert.match(BUYER_OPPORTUNITY_FRAMING_SECTION, /not as a seller failure or a critical deficiency/i)
  assert.match(BUYER_OPPORTUNITY_FRAMING_SECTION, /AEO \(Answer Engine Optimization\)/)
  assert.match(BUYER_OPPORTUNITY_FLAG_RULE, /buyer growth \/ value-add opportunities/i)
  assert.match(BUYER_OPPORTUNITY_FLAG_RULE, /rather than seller failures/i)
})
