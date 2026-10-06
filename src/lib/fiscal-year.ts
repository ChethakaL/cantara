export const FISCAL_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export function fiscalMonthLength(month: number) {
  // February 29 is available for leap-year fiscal calendars; the default remains February 28.
  return month === 2 ? 29 : [4, 6, 9, 11].includes(month) ? 30 : 31
}

export function defaultFiscalMonthEnd(month: number) {
  return month === 2 ? 28 : fiscalMonthLength(month)
}

export function parseFiscalYearEnd(value: string): { month: number; day: number } | null {
  const dated = value.match(/^([A-Za-z]+)\s+(\d{1,2})$/)
  if (dated) {
    const month = FISCAL_MONTHS.findIndex(item => item.toLowerCase() === dated[1].toLowerCase()) + 1
    const day = Number(dated[2])
    if (month && day >= 1 && day <= fiscalMonthLength(month)) return { month, day }
  }

  // Existing records stored the fiscal year start month. Display the prior month end.
  const legacyStartMonth = FISCAL_MONTHS.findIndex(item => item.toLowerCase() === value.trim().toLowerCase()) + 1
  if (legacyStartMonth) {
    const month = legacyStartMonth === 1 ? 12 : legacyStartMonth - 1
    return { month, day: defaultFiscalMonthEnd(month) }
  }
  return null
}

export function fiscalYearEndFromAnswer(value: unknown): { month: number; day: number } | undefined {
  const parsed = parseFiscalYearEnd(String(value ?? '').trim())
  return parsed ?? undefined
}

export function fiscalYearStartMonthFromAnswer(value: unknown): number | undefined {
  const answer = String(value ?? '').trim()
  if (!answer) return undefined
  if (/^[A-Za-z]+\s+\d{1,2}$/.test(answer)) {
    const endMonth = parseFiscalYearEnd(answer)?.month
    return endMonth ? (endMonth % 12) + 1 : undefined
  }
  // Preserve behavior for previously saved answers that contain only the old start month.
  const legacyStartMonth = FISCAL_MONTHS.findIndex(month => month.toLowerCase() === answer.toLowerCase()) + 1
  return legacyStartMonth || undefined
}
