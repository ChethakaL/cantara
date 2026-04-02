import Anthropic from '@anthropic-ai/sdk'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)

function loadPdfParse(): (buffer: Buffer) => Promise<{ text: string }> {
  return require('pdf-parse')
}

function loadMammoth(): { extractRawText: (args: { buffer: Buffer }) => Promise<{ value: string }> } {
  return require('mammoth')
}

function extractAnthropicText(result: Anthropic.Messages.Message) {
  return result.content
    .filter((block) => block.type === 'text')
    .map((block) => ('text' in block ? block.text : ''))
    .join('')
    .trim()
}

function trimMeetingNotes(text: string) {
  return text.replace(/\u0000/g, '').replace(/\r\n/g, '\n').trim()
}

export async function extractMeetingNotesText(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer())
  const name = file.name || 'meeting-notes'
  const lower = name.toLowerCase()
  const type = file.type || 'application/octet-stream'

  if (type.startsWith('text/') || /\.(txt|md|csv|json)$/i.test(lower)) {
    return trimMeetingNotes(buffer.toString('utf8'))
  }

  if (type === 'application/pdf' || lower.endsWith('.pdf')) {
    const pdfParse = loadPdfParse()
    const result = await pdfParse(buffer)
    return trimMeetingNotes(result.text)
  }

  if (
    type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    lower.endsWith('.docx')
  ) {
    const mammoth = loadMammoth()
    const result = await mammoth.extractRawText({ buffer })
    return trimMeetingNotes(result.value)
  }

  const fallback = trimMeetingNotes(buffer.toString('utf8'))
  if (fallback) return fallback

  throw new Error('Unsupported notes file type. Upload TXT, MD, PDF, or DOCX.')
}

export async function generateMeetingReport(args: {
  clientName: string
  title: string
  startAt: Date
  agenda: string
  agendaTags: string[]
  meetingUrl?: string | null
  notesText: string
}) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is required to generate meeting reports.')
  }

  const client = new Anthropic({ apiKey })
  const prompt = `You are Cantara's internal meetings analysis agent.

Generate a full, detailed internal meeting report for the Cantara admin team based only on the supplied meeting context and notes.

Return Markdown with these exact sections:
## Meeting Snapshot
## Executive Summary
## Agenda Coverage
## Key Discussion Points
## Decisions Made
## Risks and Blockers
## Action Items
## Follow-Up Questions
## Admin Strategic Considerations

Rules:
- Be concrete and specific.
- Extract the fullest possible detail from the notes. Do not compress multiple important facts into one sentence when separate bullets or paragraphs would be clearer.
- Use every material signal in the transcript, including metrics, growth rates, pricing guardrails, dependencies, risks, owners, conditions, objections, approvals, sequencing, and timing.
- If a section is partially unsupported by the notes, say that clearly rather than inventing facts.
- If the notes support a detail, include it. Do not omit quantitative details just to stay concise.
- In Action Items, use a Markdown table with columns: Owner | Action | Timing | Evidence.
- In Agenda Coverage, explicitly state whether each agenda tag/topic was covered, partially covered, or not evidenced.
- In Key Discussion Points, break the discussion into discrete themes with sub-bullets where appropriate.
- In Decisions Made, capture the exact outcome, any conditions attached to approval, and what still needs to be validated.
- In Risks and Blockers, separate commercial, operational, integration, financial, and people risks when the notes support them.
- In Follow-Up Questions, include diligence questions and unresolved assumptions implied by the conversation, not only explicit questions asked out loud.
- In Admin Strategic Considerations, write the practical internal interpretation the Cantara admin team should care about next, including valuation posture, diligence priorities, integration pacing, retention needs, and decision thresholds where evidenced.
- Prefer rich bullets, short subsections, and tables over vague narrative when that improves scanability.
- Keep the tone professional and decision-useful.

Meeting context:
- Client: ${args.clientName}
- Meeting title: ${args.title}
- Meeting date: ${args.startAt.toISOString()}
- Meeting link: ${args.meetingUrl || 'Not provided'}
- Agenda text: ${args.agenda || 'Not provided'}
- Agenda tags: ${args.agendaTags.length ? args.agendaTags.join(', ') : 'None provided'}

Meeting notes:
${args.notesText}`

  const result = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    temperature: 0,
    messages: [
      {
        role: 'user',
        content: [{ type: 'text', text: prompt }],
      },
    ],
  })

  return {
    report: extractAnthropicText(result),
    metadata: {
      model: 'claude-sonnet-4-20250514',
      generatedAt: new Date().toISOString(),
      agendaTags: args.agendaTags,
    },
  }
}
