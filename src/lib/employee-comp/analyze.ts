import type { AgentAiProvider } from '@/lib/agent-model-provider'
import { requireAIClient, resolveModel } from '@/lib/ai-client'
import { createAgentMessage } from '@/lib/llm-completion'

export interface EmployeeCompRow {
  id: string
  employeeName: string
  hireDate: string
  rehireDate: string
  employeeType: string
  workLocation: string
  jobTitle: string
  payType: 'Hourly' | 'Salary'
  annualSalary: number | null
  hourlyRate: number | null
  payRateEffectiveDate: string
  benefitClassCode: string
  benefitClassDescription: string
}

export interface EmployeeCompReport {
  employees: EmployeeCompRow[]
  summary: {
    totalHeadcount: number
    fullTimeCount: number
    partTimeCount: number
    totalAnnualPayroll: number
    avgHourlyRate: number | null
    avgSalary: number | null
    locationBreakdown: Record<string, number>
    roleBreakdown: Record<string, number>
  }
  generatedAt: string
}

const SYSTEM_PROMPT = `You are an M&A compensation analyst. Extract every employee compensation record from the provided payroll document or text.

For each employee, extract:
- employeeName: Full name
- hireDate: Original hire date (YYYY-MM-DD or empty string if unknown)
- rehireDate: Rehire date if applicable (empty string if none)
- employeeType: "Regular Full Time" or "Regular Part Time"
- workLocation: Office/branch location
- jobTitle: Job title / position
- payType: "Hourly" or "Salary"
- annualSalary: Annual salary amount (number or null). For hourly employees with no stated annual salary, calculate as hourlyRate * 2080.
- hourlyRate: Hourly rate (number or null). For salaried employees, calculate as annualSalary / 2080.
- payRateEffectiveDate: Date the current pay rate became effective (YYYY-MM-DD or empty string)
- benefitClassCode: Benefit class code (e.g. "FT", "PT", or whatever is listed; empty string if unknown)
- benefitClassDescription: Description of the benefit class (e.g. "Full Time Benefits", "Part Time No Benefits"; empty string if unknown)

Return ONLY valid JSON in this exact shape:
{
  "employees": [
    {
      "employeeName": "string",
      "hireDate": "string",
      "rehireDate": "string",
      "employeeType": "string",
      "workLocation": "string",
      "jobTitle": "string",
      "payType": "Hourly" | "Salary",
      "annualSalary": number | null,
      "hourlyRate": number | null,
      "payRateEffectiveDate": "string",
      "benefitClassCode": "string",
      "benefitClassDescription": "string"
    }
  ]
}

Be thorough. Extract EVERY employee you can find. Do not skip or summarize.
Return ONLY the JSON object. No markdown fences, no commentary before or after.`

const MAX_OUTPUT_TOKENS = Number(process.env.EMPLOYEE_COMP_MAX_TOKENS) || 16000

function buildSummary(employees: EmployeeCompRow[]): EmployeeCompReport['summary'] {
  const fullTime = employees.filter(e => e.employeeType.toLowerCase().includes('full'))
  const partTime = employees.filter(e => e.employeeType.toLowerCase().includes('part'))

  const hourlyEmployees = employees.filter(e => e.payType === 'Hourly' && e.hourlyRate !== null)
  const salariedEmployees = employees.filter(e => e.payType === 'Salary' && e.annualSalary !== null)

  const totalAnnualPayroll = employees.reduce((sum, e) => {
    if (e.annualSalary) return sum + e.annualSalary
    if (e.hourlyRate) return sum + e.hourlyRate * 2080
    return sum
  }, 0)

  const avgHourlyRate = hourlyEmployees.length > 0
    ? hourlyEmployees.reduce((s, e) => s + (e.hourlyRate ?? 0), 0) / hourlyEmployees.length
    : null

  const avgSalary = salariedEmployees.length > 0
    ? salariedEmployees.reduce((s, e) => s + (e.annualSalary ?? 0), 0) / salariedEmployees.length
    : null

  const locationBreakdown: Record<string, number> = {}
  const roleBreakdown: Record<string, number> = {}
  for (const e of employees) {
    const loc = e.workLocation || 'Unknown'
    locationBreakdown[loc] = (locationBreakdown[loc] || 0) + 1
    const role = e.jobTitle || 'Unknown'
    roleBreakdown[role] = (roleBreakdown[role] || 0) + 1
  }

  return {
    totalHeadcount: employees.length,
    fullTimeCount: fullTime.length,
    partTimeCount: partTime.length,
    totalAnnualPayroll: Math.round(totalAnnualPayroll * 100) / 100,
    avgHourlyRate: avgHourlyRate !== null ? Math.round(avgHourlyRate * 100) / 100 : null,
    avgSalary: avgSalary !== null ? Math.round(avgSalary * 100) / 100 : null,
    locationBreakdown,
    roleBreakdown,
  }
}

function assignIds(rows: Omit<EmployeeCompRow, 'id'>[]): EmployeeCompRow[] {
  return rows.map((r, i) => ({ ...r, id: `emp-${Date.now()}-${i}` }))
}

function stripJsonFence(text: string) {
  const t = text.trim()
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/im.exec(t)
  if (fence) return fence[1].trim()
  return t
}

function parsePayrollJson(rawText: string): { employees?: Omit<EmployeeCompRow, 'id'>[] } {
  const cleaned = stripJsonFence(rawText)
  try {
    return JSON.parse(cleaned) as { employees?: Omit<EmployeeCompRow, 'id'>[] }
  } catch {
    // Models often append commentary after a valid JSON object — slice the outer object.
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1)) as { employees?: Omit<EmployeeCompRow, 'id'>[] }
      } catch {
        /* fall through */
      }
    }
  }
  throw new Error(
    'Payroll analysis returned invalid JSON. Try again, or split a very large spreadsheet into fewer employees per file.',
  )
}

async function requestPayrollExtraction(args: {
  provider: AgentAiProvider
  modelId?: string
  system: string
  content: any[]
  maxTokens: number
}): Promise<{ rawText: string; truncated: boolean }> {
  if (args.provider === 'openai') {
    const rawText = await createAgentMessage({
      provider: args.provider,
      model: args.modelId,
      system: args.system,
      content: args.content as Parameters<typeof createAgentMessage>[0]['content'],
      maxTokens: args.maxTokens,
      temperature: 0,
    })
    return { rawText: rawText.trim(), truncated: false }
  }

  const client = await requireAIClient()
  const response = await client.messages.create({
    model: resolveModel('claude-sonnet-4-20250514'),
    max_tokens: args.maxTokens,
    temperature: 0,
    system: args.system,
    messages: [{ role: 'user', content: args.content }],
  })
  const rawText = response.content
    .filter((b) => b.type === 'text')
    .map((b) => ('text' in b ? b.text : ''))
    .join('')
    .trim()
  return { rawText, truncated: response.stop_reason === 'max_tokens' }
}

export async function analyzePayrollDocument(args: {
  fileName?: string
  base64?: string
  mediaType?: string
  freeText?: string
  provider?: AgentAiProvider
  modelId?: string
}): Promise<EmployeeCompReport> {
  const provider = args.provider ?? 'bedrock'
  const content: any[] = []

  if (args.base64 && args.mediaType) {
    if (args.mediaType === 'application/pdf') {
      content.push({
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: args.base64 },
      })
    } else if (args.mediaType.startsWith('image/')) {
      content.push({
        type: 'image',
        source: { type: 'base64', media_type: args.mediaType, data: args.base64 },
      })
    } else if (
      args.mediaType.includes('spreadsheet')
      || args.mediaType.includes('excel')
      || args.fileName?.endsWith('.xlsx')
      || args.fileName?.endsWith('.xls')
      || args.fileName?.endsWith('.csv')
    ) {
      // Excel/CSV: parse server-side and send as text (Claude only accepts PDF/images as binary docs)
      try {
        const XLSX = require('xlsx')
        const buffer = Buffer.from(args.base64, 'base64')
        const workbook = XLSX.read(buffer, { type: 'buffer' })
        const textParts: string[] = []
        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName]
          const csv = XLSX.utils.sheet_to_csv(sheet)
          textParts.push(`=== Sheet: ${sheetName} ===\n${csv}`)
        }
        content.push({
          type: 'text',
          text: `Payroll spreadsheet contents (${args.fileName || 'uploaded file'}):\n\n${textParts.join('\n\n')}`,
        })
      } catch (parseErr) {
        console.error('Failed to parse spreadsheet, sending as raw text:', parseErr)
        const decoded = Buffer.from(args.base64, 'base64').toString('utf-8')
        content.push({
          type: 'text',
          text: `Payroll file contents (${args.fileName || 'uploaded file'}):\n\n${decoded.slice(0, 50000)}`,
        })
      }
    }
  }

  const textInstruction = args.freeText
    ? `Extract all employee compensation records from the following payroll data:\n\n${args.freeText}`
    : `Extract all employee compensation records from this payroll document (${args.fileName || 'uploaded file'}).`

  content.push({ type: 'text', text: textInstruction })

  let { rawText, truncated } = await requestPayrollExtraction({
    provider,
    modelId: args.modelId,
    system: SYSTEM_PROMPT,
    content,
    maxTokens: MAX_OUTPUT_TOKENS,
  })

  let parsed: { employees?: Omit<EmployeeCompRow, 'id'>[] }
  try {
    parsed = parsePayrollJson(rawText)
  } catch (firstError) {
    // One retry with a stricter "JSON only" reminder — handles flaky trailing commentary.
    const retry = await requestPayrollExtraction({
      provider,
      modelId: args.modelId,
      system: `${SYSTEM_PROMPT}\n\nCRITICAL: Your previous response was not valid parseable JSON. Reply with the JSON object only.`,
      content,
      maxTokens: MAX_OUTPUT_TOKENS,
    })
    rawText = retry.rawText
    truncated = truncated || retry.truncated
    try {
      parsed = parsePayrollJson(rawText)
    } catch {
      if (truncated) {
        throw new Error(
          `Payroll analysis hit the ${MAX_OUTPUT_TOKENS} token output limit before finishing. Split the spreadsheet or raise EMPLOYEE_COMP_MAX_TOKENS.`,
        )
      }
      throw firstError
    }
  }

  if (truncated && (!parsed.employees || parsed.employees.length === 0)) {
    throw new Error(
      `Payroll analysis hit the ${MAX_OUTPUT_TOKENS} token output limit before finishing. Split the spreadsheet or raise EMPLOYEE_COMP_MAX_TOKENS.`,
    )
  }

  const employees = assignIds(parsed.employees ?? [])

  for (const emp of employees) {
    if (emp.payType === 'Hourly' && emp.annualSalary === null && emp.hourlyRate !== null) {
      emp.annualSalary = Math.round(emp.hourlyRate * 2080 * 100) / 100
    }
    if (emp.payType === 'Salary' && emp.hourlyRate === null && emp.annualSalary !== null) {
      emp.hourlyRate = Math.round((emp.annualSalary / 2080) * 100) / 100
    }
  }

  return {
    employees,
    summary: buildSummary(employees),
    generatedAt: new Date().toISOString(),
  }
}
