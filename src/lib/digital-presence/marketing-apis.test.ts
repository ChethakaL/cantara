import assert from 'node:assert/strict'
import test from 'node:test'
import { collectMarketingApiEvidence, fetchDataForSeoOrganic, isPageSpeedDocumentFetchFailure, normalizedLocation } from './marketing-apis.ts'

test('normalizes a Canadian street address for DataForSEO location_name', () => {
  assert.equal(
    normalizedLocation('760 Terminal Avenue, Vancouver, BC V6A 2M5, Canada'),
    'Vancouver,British Columbia,Canada',
  )
})

test('normalizes a US street address for DataForSEO location_name', () => {
  assert.equal(
    normalizedLocation('123 Main St, Seattle, WA 98101, USA'),
    'Seattle,Washington,United States',
  )
})

test('keeps a canonical city, region, country location', () => {
  assert.equal(
    normalizedLocation('Vancouver, British Columbia, Canada'),
    'Vancouver,British Columbia,Canada',
  )
})

test('recognizes PageSpeed target crawl failures separately from API failures', () => {
  assert.equal(isPageSpeedDocumentFetchFailure('Lighthouse returned error: FAILED_DOCUMENT_REQUEST (Details: net::ERR_TIMED_OUT)'), true)
  assert.equal(isPageSpeedDocumentFetchFailure('API key not valid. Please pass a valid API key.'), false)
})

test('builds one location-specific organic search request and identifies the client result', async () => {
  const previousFetch = globalThis.fetch
  let requestUrl = ''
  let requestBody = ''
  globalThis.fetch = async (input, init) => {
    requestUrl = String(input)
    requestBody = String(init?.body ?? '')
    return new Response(JSON.stringify({ tasks: [{ status_code: 20000, result: [{ items: [
      { type: 'organic', rank_absolute: 3, domain: 'tailsawagn.net', title: 'Tails A Wagn', url: 'https://tailsawagn.net/' },
      { type: 'paid', rank_absolute: 1, domain: 'competitor.example', title: 'Competitor Ad', url: 'https://competitor.example/' },
    ] }] }] }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }
  try {
    const result = await fetchDataForSeoOrganic({
      businessName: 'Tails-A-Wagn', businessAddress: '1199 W Country Club Rd, Claremore, OK 74017', websiteUrl: 'https://www.tailsawagn.net',
    }, async () => ({ login: 'test-login', password: 'test-password' }))
    assert.equal(requestUrl, 'https://api.dataforseo.com/v3/serp/google/organic/live/advanced')
    assert.deepEqual(JSON.parse(requestBody), [{ keyword: 'dog boarding Claremore', location_name: 'Claremore,Oklahoma,United States', language_code: 'en', depth: 10 }])
    assert.equal(result.status, 'connected')
    assert.match(result.content, /Organic result 3: tailsawagn\.net \[CLIENT WEBSITE\]/)
    assert.match(result.content, /Paid placement 1: competitor\.example/)
  } finally {
    globalThis.fetch = previousFetch
  }
})

test('reads review counts from the Maps rating votes_count field', async () => {
  const previousFetch = globalThis.fetch
  globalThis.fetch = async (input) => {
    const url = String(input)
    const items = url.includes('/maps/')
      ? [{ rank_absolute: 1, title: 'Tails-A-Wagn Multi Service Pet Care', address: '1199 W Country Club Rd, Claremore, OK 74017', rating: { value: 4.7, votes_count: 202 }, domain: 'tailsawagn.net' }]
      : []
    return new Response(JSON.stringify({ tasks: [{ status_code: 20000, result: [{ items }] }] }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }
  try {
    const evidence = await collectMarketingApiEvidence(
      { businessName: 'Tails-A-Wagn', businessAddress: '1199 W Country Club Rd, Claremore, OK 74017' },
      { loadDataForSeoCredentials: async () => ({ login: 'test-login', password: 'test-password' }) },
    )
    const maps = evidence.find(item => item.source === 'DataForSEO Google Maps local results')
    assert.equal(maps?.status, 'connected')
    assert.match(maps?.content ?? '', /review count 202/)
  } finally {
    globalThis.fetch = previousFetch
  }
})
