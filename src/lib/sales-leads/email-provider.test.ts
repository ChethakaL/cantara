import test from 'node:test'
import assert from 'node:assert/strict'
import { SalesLeadContactType } from '@prisma/client'
import {
  buildSenderFooterFromUser,
  buildVerifiedCompliment,
  interpolateSalesLeadTemplate,
  senderLastNameFromDisplayName,
} from './email-template.ts'
import { parseEmailList, withoutEmail } from './email-recipients.ts'

const sitStayPlay = {
  businessName: 'Sit! Stay! Play!',
  ownerFirstName: 'Janet',
  ownerLastName: 'Galante',
  ownerEmail: 'janet@sitstayplaytucson.com',
  emailType: SalesLeadContactType.DIRECT,
  city: 'Tucson',
  state: 'AZ',
  googleRating: 4.8,
  reviewCount: 130,
  sqftCombined: 7500,
  websiteUrl: 'https://www.sitstayplaytucson.com/',
  aiResearchReport: {
    recommendedPersonalization: '1. Reference the facility\'s strong 4.8-star Google rating and 130 reviews as evidence of a loyal, satisfied client base. 2. With 7,500 combined sq ft, ask about capacity.',
    businessProfileSummary: 'Sit! Stay! Play! is an independently owned pet resort in Tucson.',
  },
}

const gabyTemplate = `Hi [First Name],

I wanted to reach out because of what you’ve built at [Facility Name]. A [AI-generated natural, openly complimentary sentence based on one verified positive fact] is an impressive accomplishment.

My name is Gabriela [Last Name], and I’m with Cantara Pet Business Advisors.

Looking forward to connecting you with Craig.

Gabriela [Last Name]
Business Development
Cantara Pet Business Advisors`

test('5a - compliment uses verified facts, not internal talking points', () => {
  const body = interpolateSalesLeadTemplate(gabyTemplate, sitStayPlay, { name: 'Gabriela' })
  assert.match(body, /Maintaining a 4\.8-star Google rating across 130 reviews is an impressive accomplishment\./)
  assert.doesNotMatch(body, /AI-generated/)
  assert.doesNotMatch(body, /1\. Reference/)
  assert.doesNotMatch(body, /ask about capacity/)
  assert.doesNotMatch(body, /independently owned pet resort in Tucson/)
})

test('5b - sender last name is not the owner last name', () => {
  const body = interpolateSalesLeadTemplate(gabyTemplate, sitStayPlay, { name: 'Gabriela' })
  assert.match(body, /Hi Janet,/)
  assert.doesNotMatch(body, /Galante/)
  assert.match(body, /My name is Gabriela, and I’m with Cantara Pet Business Advisors\./)
  assert.match(body, /Gabriela\nBusiness Development/)
})

test('5b - full sender display name fills the last-name placeholder', () => {
  const body = interpolateSalesLeadTemplate(gabyTemplate, sitStayPlay, { name: 'Gabriela Torres' })
  assert.doesNotMatch(body, /Galante/)
  assert.match(body, /My name is Gabriela Torres, and I’m with Cantara Pet Business Advisors\./)
  assert.match(body, /Gabriela Torres\nBusiness Development/)
})

test('sender last name is taken from a full display name only', () => {
  assert.equal(senderLastNameFromDisplayName('Gabriela'), '')
  assert.equal(senderLastNameFromDisplayName('Gabriela Torres'), 'Torres')
  assert.equal(senderLastNameFromDisplayName('Craig Pollack'), 'Pollack')
})

test('verified compliment prefers rating and review count', () => {
  assert.equal(
    buildVerifiedCompliment(sitStayPlay),
    'Maintaining a 4.8-star Google rating across 130 reviews is an impressive accomplishment.',
  )
})

test('asset fill-in fields replace calendar, phone, and guide placeholders', () => {
  const template = `Please book here: [LINK]
Guide: [SELL ONE DAY GUIDE LINK]
Call [phone].`
  const body = interpolateSalesLeadTemplate(template, sitStayPlay, { name: 'Gabriela Torres' }, {
    calendarUrl: 'https://calendly.com/craig/intro',
    senderPhone: '(206) 202-5014',
    guideUrl: 'https://cantara.example/guide',
  })
  assert.match(body, /https:\/\/calendly\.com\/craig\/intro/)
  assert.match(body, /https:\/\/cantara\.example\/guide/)
  assert.match(body, /\(206\) 202-5014/)
  assert.doesNotMatch(body, /Galante/)
})

test('[Footer] is replaced from the advisor sender footer settings', () => {
  const template = `Looking forward to connecting.\n\n[Footer]`
  const body = interpolateSalesLeadTemplate(template, sitStayPlay, { name: 'Chethaka Lakshitha' }, {
    senderFooter: 'Chethaka Lakshitha\nAI Engineer\n123456789',
  })
  assert.match(body, /Looking forward to connecting\.\n\nChethaka Lakshitha\nAI Engineer\n123456789/)
  assert.doesNotMatch(body, /\[Footer\]/)
})

test('HTML sender footer takes precedence over simple text fields', () => {
  const footer = buildSenderFooterFromUser({
    name: 'Craig Pollack',
    emailFooterName: 'Ignored Name',
    emailFooterTitle: 'Ignored Title',
    emailFooterPhone: 'Ignored Phone',
    emailFooterHtml: '<table><tr><td>Craig Pollack</td></tr></table>',
  })
  assert.match(footer, /<table>/)
  assert.doesNotMatch(footer, /Ignored Name/)
})

test('simple sender footer is built from name, title, and phone', () => {
  const footer = buildSenderFooterFromUser({
    name: 'Chethaka Lakshitha',
    emailFooterName: 'Chethaka Lakshitha',
    emailFooterTitle: 'AI Engineer',
    emailFooterPhone: '123456789',
    emailFooterHtml: '',
  })
  assert.equal(footer, 'Chethaka Lakshitha\nAI Engineer\n123456789')
})

test('5c - empty calendar and phone placeholders stay visible until filled', () => {
  const template = 'Book here: [LINK]. Call [phone].'
  const body = interpolateSalesLeadTemplate(template, sitStayPlay, { name: 'Gabriela' })
  assert.match(body, /\[LINK\]/)
  assert.match(body, /\[phone\]/)
  assert.doesNotMatch(body, /sitstayplaytucson/)
})

test('optional extra To and Cc emails are parsed, lowercased, and de-duplicated', () => {
  assert.deepEqual(
    parseEmailList('Craig@cantarapet.com, gaby@cantarapet.com; CRAIG@cantarapet.com'),
    ['craig@cantarapet.com', 'gaby@cantarapet.com'],
  )
  assert.deepEqual(parseEmailList(['  Gaby@cantarapet.com  ', '']), ['gaby@cantarapet.com'])
  assert.deepEqual(withoutEmail(['janet@sitstayplaytucson.com', 'gaby@cantarapet.com'], 'Janet@sitstayplaytucson.com'), [
    'gaby@cantarapet.com',
  ])
})

test('invalid extra recipient emails are rejected', () => {
  assert.throws(() => parseEmailList('not-an-email'), /Invalid email address: not-an-email/)
})
