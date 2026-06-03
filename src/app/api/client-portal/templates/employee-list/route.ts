import * as XLSX from 'xlsx'
import { NextResponse } from 'next/server'

export async function GET() {
  const rows = [
    ['Employee Name', 'Job Title', 'Employment Type (FT/PT)', 'Avg Weekly Hours', 'Compensation (annual or hourly)', 'Notes'],
    ['Jane Smith', 'General Manager', 'FT', '40', '$75,000 salary', ''],
    ['', '', '', '', '', ''],
  ]
  const sheet = XLSX.utils.aoa_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, 'Employee List')
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="Employee_List_Template.xlsx"',
    },
  })
}
