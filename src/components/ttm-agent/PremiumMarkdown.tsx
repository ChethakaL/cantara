'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'

// Simple helper to clean up unwanted names in markdown output 
function sanitizeMarkdown(text: string | null | undefined): string {
  if (!text) return ''
  return text
    .replace(/SUMMARY FOR CRAIG/gi, 'SUMMARY')
    .replace(/SUMMARY FOR ADMIN/gi, 'SUMMARY')
    .replace(/ALERTS FOR CRAIG/gi, 'ALERTS')
    .replace(/ALERTS FOR ADMIN/gi, 'ALERTS')
    .replace(/CRAIG/g, 'ADMIN')
    .replace(/Craig/g, 'Admin')
    .replace(/craig/g, 'admin')
}

// Custom renders for Markdown to match the premium dark/gold Cantara theme
const PremiumMarkdownComponents = {
  h1: ({ children, ...props }: any) => (
    <h1 className="text-2xl font-bold tracking-tight text-[#1a2332] mt-8 mb-4 border-b border-slate-200 pb-2" {...props}>
      {children}
    </h1>
  ),
  h2: ({ children, ...props }: any) => (
    <h2 className="text-[14px] font-bold tracking-widest text-[#1a2332] uppercase mt-8 mb-4 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 shadow-sm" {...props}>
      {children}
    </h2>
  ),
  h3: ({ children, ...props }: any) => {
    // Check if it's a known section like 'Summary' or 'Alerts'
    const text = String(children || '')
    const isAlert = text.toUpperCase().includes('ALERTS')
    
    return (
      <h3 className="text-[12px] font-bold tracking-widest text-slate-500 uppercase mt-6 mb-3 flex items-center gap-2" {...props}>
        {isAlert && <AlertTriangle className="w-4 h-4 text-amber-500" />}
        {children}
      </h3>
    )
  },
  table: ({ children, ...props }: any) => (
    <div className="overflow-x-auto my-6 border border-slate-200 rounded-xl shadow-sm bg-white">
      <table className="w-full text-sm text-left" {...props}>
        {children}
      </table>
    </div>
  ),
  thead: ({ children, ...props }: any) => (
    <thead className="bg-[#1a2332] text-white" {...props}>
      {children}
    </thead>
  ),
  th: ({ children, ...props }: any) => (
    <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-widest border-b border-slate-700" {...props}>
      {children}
    </th>
  ),
  td: ({ children, ...props }: any) => {
    const text = String(children || '')
    const isStatus = /^(HIGH|MEDIUM|LOW|VERIFIED|CALCULATED|DEFAULT)$/i.test(text.trim())
    
    return (
      <td className="px-5 py-3 border-b border-slate-100 last:border-none text-slate-700 font-medium" {...props}>
        {isStatus ? (
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest 
            ${text.trim().toUpperCase() === 'HIGH' ? 'bg-rose-100 text-rose-700' : 
              text.trim().toUpperCase() === 'MEDIUM' ? 'bg-amber-100 text-amber-700' : 
              text.trim().toUpperCase() === 'VERIFIED' ? 'bg-emerald-100 text-emerald-700' : 
              'bg-slate-100 text-slate-600'}`}>
            {children}
          </span>
        ) : (
          children
        )}
      </td>
    )
  },
  tr: ({ children, ...props }: any) => (
    <tr className="hover:bg-slate-50/80 transition-colors" {...props}>
      {children}
    </tr>
  ),
  blockquote: ({ children, ...props }: any) => (
    <blockquote className="border-l-4 border-amber-400 pl-4 py-1 my-4 bg-amber-50/50 rounded-r-lg text-slate-700 italic" {...props}>
      {children}
    </blockquote>
  ),
  ul: ({ children, ...props }: any) => (
    <ul className="space-y-2 my-4 pl-2 list-none" {...props}>
      {children}
    </ul>
  ),
  li: ({ children, ...props }: any) => (
    <li className="flex items-start gap-3 text-slate-600" {...props}>
      <span className="w-1.5 h-1.5 bg-amber-400 rounded-full mt-2 shrink-0 shadow-sm" />
      <span className="leading-relaxed">{children}</span>
    </li>
  ),
  strong: ({ children, ...props }: any) => (
    <strong className="font-bold text-[#1a2332]" {...props}>
      {children}
    </strong>
  ),
}

export function PremiumMarkdown({ 
  children, 
  className 
}: { 
  children: string | null | undefined
  className?: string 
}) {
  const sanitized = sanitizeMarkdown(children)

  return (
    <div className={className}>
      <ReactMarkdown 
        remarkPlugins={[remarkGfm]}
        components={PremiumMarkdownComponents}
      >
        {sanitized}
      </ReactMarkdown>
    </div>
  )
}
