'use client'

import { Plus, Trash2 } from 'lucide-react'

type TextLine =
  | { kind: 'h1'; text: string }
  | { kind: 'h2'; text: string }
  | { kind: 'h3'; text: string }
  | { kind: 'bullet'; text: string }
  | { kind: 'number'; text: string; number: string }
  | { kind: 'hr' }
  | { kind: 'paragraph'; text: string }
  | { kind: 'blank' }

function parseTextLines(content: string): TextLine[] {
  return content.split('\n').map(line => {
    if (!line.trim()) return { kind: 'blank' as const }
    if (/^---+$/.test(line.trim())) return { kind: 'hr' as const }
    const h1 = line.match(/^#\s+(.+)$/)
    if (h1) return { kind: 'h1' as const, text: h1[1] }
    const h2 = line.match(/^##\s+(.+)$/)
    if (h2) return { kind: 'h2' as const, text: h2[1] }
    const h3 = line.match(/^###\s+(.+)$/)
    if (h3) return { kind: 'h3' as const, text: h3[1] }
    const bullet = line.match(/^[-*]\s+(.+)$/)
    if (bullet) return { kind: 'bullet' as const, text: bullet[1] }
    const numbered = line.match(/^(\d+)\.\s+(.+)$/)
    if (numbered) return { kind: 'number' as const, number: numbered[1], text: numbered[2] }
    return { kind: 'paragraph' as const, text: line }
  })
}

function serializeTextLines(lines: TextLine[]): string {
  return lines
    .map(line => {
      switch (line.kind) {
        case 'h1': return `# ${line.text}`
        case 'h2': return `## ${line.text}`
        case 'h3': return `### ${line.text}`
        case 'bullet': return `- ${line.text}`
        case 'number': return `${line.number}. ${line.text}`
        case 'hr': return '---'
        case 'blank': return ''
        default: return line.text
      }
    })
    .join('\n')
}

function updateLine(lines: TextLine[], index: number, next: TextLine): TextLine[] {
  return lines.map((line, lineIndex) => (lineIndex === index ? next : line))
}

function deleteLine(lines: TextLine[], index: number): TextLine[] {
  return lines.filter((_, lineIndex) => lineIndex !== index)
}

const fieldClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100'

export function EditableTextBlock({
  content,
  onChange,
}: {
  content: string
  onChange: (content: string) => void
}) {
  const lines = parseTextLines(content)

  const commit = (nextLines: TextLine[]) => {
    onChange(serializeTextLines(nextLines))
  }

  const addLine = (kind: 'bullet' | 'paragraph') => {
    if (kind === 'bullet') {
      commit([...lines, { kind: 'bullet', text: '' }])
    } else {
      commit([...lines, { kind: 'paragraph', text: '' }])
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/40 p-4">
      {lines.map((line, index) => {
        if (line.kind === 'blank') return <div key={index} className="h-2" />
        if (line.kind === 'hr') return <hr key={index} className="border-slate-200" />

        if (line.kind === 'h1') {
          return (
            <div key={index} className="flex items-center gap-2">
              <input
                value={line.text}
                onChange={event => commit(updateLine(lines, index, { kind: 'h1', text: event.target.value }))}
                className={`${fieldClass} border-b-2 border-emerald-200 text-2xl font-bold text-slate-900`}
              />
              <button
                type="button"
                onClick={() => commit(deleteLine(lines, index))}
                className="p-1.5 text-slate-300 hover:text-rose-500 rounded-lg hover:bg-rose-50 transition-colors"
                title="Delete heading"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )
        }

        if (line.kind === 'h2') {
          return (
            <div key={index} className="flex items-center gap-2">
              <input
                value={line.text}
                onChange={event => commit(updateLine(lines, index, { kind: 'h2', text: event.target.value }))}
                className={`${fieldClass} text-lg font-bold text-slate-900`}
              />
              <button
                type="button"
                onClick={() => commit(deleteLine(lines, index))}
                className="p-1.5 text-slate-300 hover:text-rose-500 rounded-lg hover:bg-rose-50 transition-colors"
                title="Delete heading"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )
        }

        if (line.kind === 'h3') {
          return (
            <div key={index} className="flex items-center gap-2">
              <input
                value={line.text}
                onChange={event => commit(updateLine(lines, index, { kind: 'h3', text: event.target.value }))}
                className={`${fieldClass} text-sm font-bold text-slate-800`}
              />
              <button
                type="button"
                onClick={() => commit(deleteLine(lines, index))}
                className="p-1.5 text-slate-300 hover:text-rose-500 rounded-lg hover:bg-rose-50 transition-colors"
                title="Delete heading"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )
        }

        if (line.kind === 'bullet') {
          return (
            <div key={index} className="flex items-start gap-2">
              <span className="pt-2 text-emerald-500">•</span>
              <textarea
                value={line.text}
                onChange={event => commit(updateLine(lines, index, { kind: 'bullet', text: event.target.value }))}
                rows={Math.max(1, line.text.split('\n').length)}
                className={`${fieldClass} min-h-[40px] resize-y`}
              />
              <button
                type="button"
                onClick={() => commit(deleteLine(lines, index))}
                className="p-1.5 mt-1 text-slate-300 hover:text-rose-500 rounded-lg hover:bg-rose-50 transition-colors"
                title="Delete bullet"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )
        }

        if (line.kind === 'number') {
          return (
            <div key={index} className="flex items-start gap-2">
              <span className="pt-2 min-w-[1.5rem] text-sm font-semibold text-emerald-600">{line.number}.</span>
              <textarea
                value={line.text}
                onChange={event => commit(updateLine(lines, index, { kind: 'number', number: line.number, text: event.target.value }))}
                rows={Math.max(1, line.text.split('\n').length)}
                className={`${fieldClass} min-h-[40px] resize-y`}
              />
              <button
                type="button"
                onClick={() => commit(deleteLine(lines, index))}
                className="p-1.5 mt-1 text-slate-300 hover:text-rose-500 rounded-lg hover:bg-rose-50 transition-colors"
                title="Delete line"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )
        }

        return (
          <div key={index} className="flex items-start gap-2">
            <textarea
              value={line.text}
              onChange={event => commit(updateLine(lines, index, { kind: 'paragraph', text: event.target.value }))}
              rows={Math.max(2, line.text.split('\n').length)}
              className={`${fieldClass} min-h-[56px] resize-y leading-7`}
            />
            <button
              type="button"
              onClick={() => commit(deleteLine(lines, index))}
              className="p-1.5 mt-1 text-slate-300 hover:text-rose-500 rounded-lg hover:bg-rose-50 transition-colors"
              title="Delete line"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )
      })}
      <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
        <button
          type="button"
          onClick={() => addLine('bullet')}
          className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 py-1 px-2 rounded-md hover:bg-emerald-50 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Add bullet
        </button>
        <button
          type="button"
          onClick={() => addLine('paragraph')}
          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-800 py-1 px-2 rounded-md hover:bg-slate-100 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Add paragraph
        </button>
      </div>
    </div>
  )
}
