import Anthropic from '@anthropic-ai/sdk'

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

Be thorough. Extract EVERY employee you can find. Do not skip or summarize.`

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

export async function analyzePayrollDocument(args: {
  fileName?: string
  base64?: string
  mediaType?: string
  freeText?: string
}): Promise<EmployeeCompReport> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY required')

  const client = new Anthropic({ apiKey })
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
      args.mediaType.includes('spreadsheet') ||
      args.mediaType.includes('excel') ||
      args.fileName?.endsWith('.xlsx') ||
      args.fileName?.endsWith('.xls') ||
      args.fileName?.endsWith('.csv')
    ) {
      content.push({
        type: 'document',
        source: {
          type: 'base64',
          media_type: args.mediaType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          data: args.base64,
        },
      })
    }
  }

  const textInstruction = args.freeText
    ? `Extract all employee compensation records from the following payroll data:\n\n${args.freeText}`
    : `Extract all employee compensation records from this payroll document (${args.fileName || 'uploaded file'}).`

  content.push({ type: 'text', text: textInstruction })

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8000,
    temperature: 0,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content }],
  })

  const rawText = response.content
    .filter((b) => b.type === 'text')
    .map((b) => ('text' in b ? b.text : ''))
    .join('')
    .trim()

  const cleaned = rawText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim()
  const parsed = JSON.parse(cleaned)

  const employees = assignIds(parsed.employees ?? [])

  // Back-fill estimated annual salary for hourly employees without one
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
