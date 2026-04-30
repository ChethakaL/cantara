'use client'
import { Trash2, Plus, FileSpreadsheet } from 'lucide-react'
import * as XLSX from 'xlsx-js-style'
import { LeaseReport } from '@/lib/lease-analysis/types'
import { Button } from '@/components/ui'

interface Props {
  reportMarkdown: string
  clientName: string
  onNewAnalysis: () => void
  onDelete?: () => void
  report?: LeaseReport
}

export function ReportExportBar({ clientName, onNewAnalysis, onDelete, report }: Props) {
  const handleExportExcel = () => {
    if (!report) {
      alert('Excel export is not available until the parsed lease report has loaded.')
      return
    }

    try {
      const wb = XLSX.utils.book_new()

      XLSX.utils.book_append_sheet(
        wb,
        buildStyledSheet(
          'Lease Analysis Summary',
          ['Key Item', 'Finding', 'Source'],
          (report.snapshotTable || []).map(row => [row.field, row.finding, row.sourceSection || '']),
          [28, 70, 34],
        ),
        'Summary',
      )

      const allFlags = [
        ...(report.redFlags || []).map(f => ({ ...f, Status: 'RED' })),
        ...(report.orangeFlags || []).map(f => ({ ...f, Status: 'YELLOW' })),
        ...(report.greenFlags || []).map(f => ({ ...f, Status: 'GREEN' })),
      ].map(f => ({
        Severity: f.Status,
        Issue: f.issue,
        WhyItMatters: f.whyItMatters,
        SourceSection: f.sourceSection,
      }))

      XLSX.utils.book_append_sheet(
        wb,
        buildStyledSheet(
          'Lease Risk Flags',
          ['Severity', 'Issue', 'Why It Matters', 'Source'],
          allFlags.map(f => [f.Severity, f.Issue, f.WhyItMatters, f.SourceSection]),
          [16, 44, 70, 48],
        ),
        'Flags',
      )

      XLSX.utils.book_append_sheet(
        wb,
        buildStyledSheet(
          'Lease Detailed Findings',
          ['ID', 'Title', 'Content'],
          (report.detailedFindings || []).map(f => [f.id, f.title, cleanMarkdownForExcel(f.content)]),
          [12, 36, 110],
        ),
        'Findings',
      )

      XLSX.utils.book_append_sheet(
        wb,
        buildStyledSheet(
          'Lease Documents',
          ['Document', 'Type', 'Date', 'Status'],
          (report.documentInventory || []).map(d => [d.document, d.documentType, d.date, d.status]),
          [52, 28, 18, 24],
        ),
        'Documents',
      )

      const output = XLSX.write(wb, { bookType: 'xlsx', type: 'array', cellStyles: true })
      const blob = new Blob([output], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `LeaseAnalysis_${clientName.replace(/\s+/g, '_')}.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Lease Excel export failed:', error)
      alert(error instanceof Error ? `Excel export failed: ${error.message}` : 'Excel export failed.')
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={handleExportExcel} className="gap-2 text-emerald-600 border-emerald-200 bg-emerald-50 hover:bg-emerald-100">
        <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
      </Button>
      
      <Button variant="outline" size="sm" onClick={onNewAnalysis} className="gap-2">
        <Plus className="w-3.5 h-3.5" /> New Analysis
      </Button>

      {onDelete && (
        <Button
          variant="outline" size="sm"
          className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 border-rose-100 hover:border-rose-200"
          onClick={onDelete}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      )}
    </div>
  )
}

function buildStyledSheet(title: string, headers: string[], rows: Array<Array<unknown>>, widths: number[]) {
  const generatedAt = new Date().toLocaleString()
  const data = [
    ['Cantara Pet Business Advisors'],
    [title],
    [`Generated ${generatedAt}`],
    [],
    headers,
    ...rows.map(row => row.map(value => value == null ? '' : String(value))),
  ]
  const ws = XLSX.utils.aoa_to_sheet(data)
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1')

  ws['!cols'] = widths.map(wch => ({ wch }))
  ws['!freeze'] = { xSplit: 0, ySplit: 5 }

  for (let row = range.s.r; row <= range.e.r; row += 1) {
    for (let col = range.s.c; col <= range.e.c; col += 1) {
      const addr = XLSX.utils.encode_cell({ r: row, c: col })
      if (!ws[addr]) continue

      ws[addr].s = {
        font: { name: 'Arial', sz: 10, color: { rgb: '1F2937' } },
        alignment: { vertical: 'top', wrapText: true },
        border: {
          top: { style: 'thin', color: { rgb: 'E5E7EB' } },
          bottom: { style: 'thin', color: { rgb: 'E5E7EB' } },
          left: { style: 'thin', color: { rgb: 'E5E7EB' } },
          right: { style: 'thin', color: { rgb: 'E5E7EB' } },
        },
      }
    }
  }

  styleCell(ws, 'A1', {
    font: { name: 'Arial', sz: 11, bold: true, color: { rgb: 'CAA15F' } },
    fill: { fgColor: { rgb: '21263C' } },
    alignment: { vertical: 'center' },
  })
  styleCell(ws, 'A2', {
    font: { name: 'Arial', sz: 16, bold: true, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: '21263C' } },
    alignment: { vertical: 'center' },
  })
  styleCell(ws, 'A3', {
    font: { name: 'Arial', sz: 9, italic: true, color: { rgb: '94A3B8' } },
    fill: { fgColor: { rgb: '21263C' } },
  })

  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(headers.length - 1, 0) } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: Math.max(headers.length - 1, 0) } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: Math.max(headers.length - 1, 0) } },
  ]

  headers.forEach((_, col) => {
    const addr = XLSX.utils.encode_cell({ r: 4, c: col })
    styleCell(ws, addr, {
      font: { name: 'Arial', sz: 10, bold: true, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: 'B8922A' } },
      alignment: { vertical: 'center', wrapText: true },
      border: {
        top: { style: 'thin', color: { rgb: 'B8922A' } },
        bottom: { style: 'thin', color: { rgb: 'B8922A' } },
        left: { style: 'thin', color: { rgb: 'B8922A' } },
        right: { style: 'thin', color: { rgb: 'B8922A' } },
      },
    })
  })

  ws['!rows'] = [
    { hpt: 22 },
    { hpt: 30 },
    { hpt: 20 },
    { hpt: 8 },
    { hpt: 24 },
    ...rows.map(() => ({ hpt: 42 })),
  ]

  return ws
}

function styleCell(ws: XLSX.WorkSheet, addr: string, style: Record<string, unknown>) {
  if (!ws[addr]) return
  ws[addr].s = { ...(ws[addr].s || {}), ...style }
}

function cleanMarkdownForExcel(markdown: string) {
  const lines = markdown
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(line => line.trim())

  const cleaned: string[] = []
  let tableHeaders: string[] | null = null

  for (const line of lines) {
    if (!line) {
      if (cleaned[cleaned.length - 1] !== '') cleaned.push('')
      continue
    }

    if (/^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line)) {
      continue
    }

    if (line.includes('|')) {
      const cells = line
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map(cell => stripMarkdownInline(cell.trim()))
        .filter(Boolean)

      if (cells.length > 1) {
        if (!tableHeaders) {
          tableHeaders = cells
          cleaned.push(cells.join(' / '))
        } else if (cells.length === tableHeaders.length) {
          cleaned.push(cells.map((cell, index) => `${tableHeaders?.[index] || `Column ${index + 1}`}: ${cell}`).join('; '))
        } else {
          cleaned.push(cells.join(' | '))
        }
        continue
      }
    } else {
      tableHeaders = null
    }

    cleaned.push(
      stripMarkdownInline(line)
        .replace(/^#{1,6}\s*/, '')
        .replace(/^[-*]\s+/, '• ')
        .replace(/^>\s*/, '')
        .replace(/\s+—\s+/g, ' — ')
        .trim(),
    )
  }

  return cleaned
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function stripMarkdownInline(value: string) {
  return value
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/\s+/g, ' ')
    .trim()
}
