import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: unknown[]) {
  return twMerge(clsx(inputs))
}

// ── Button ──────────────────────────────────────────────────────────────────
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'outline' | 'danger'
  size?: 'sm' | 'md' | 'lg'
}
export function Button({ variant = 'primary', size = 'md', className, children, ...props }: ButtonProps) {
  const base = 'inline-flex items-center gap-2 font-medium transition-all rounded-lg disabled:opacity-50 disabled:cursor-not-allowed'
  const variants = {
    primary: 'text-cantara-sun hover:opacity-90',
    ghost: 'text-slate-500 hover:text-slate-800 hover:bg-slate-100',
    outline: 'border border-cantara-beige text-slate-700 hover:bg-cantara-beige/50',
    danger: 'bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100',
  }
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-6 py-3 text-base' }
  const style = variant === 'primary' ? { background: '#21263C' } : {}
  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      style={style}
      {...props}
    >
      {children}
    </button>
  )
}

// ── Badge ───────────────────────────────────────────────────────────────────
interface BadgeProps { children: React.ReactNode; color?: 'gold' | 'green' | 'red' | 'blue' | 'slate' | 'gray'; className?: string }
export function Badge({ children, color = 'slate', className }: BadgeProps) {
  const colors = {
    gold: 'border-cantara-gold/30 text-cantara-navy',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    red: 'bg-rose-50 text-rose-700 border-rose-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    slate: 'bg-slate-100 text-slate-600 border-slate-200',
    gray: 'bg-slate-50 text-slate-400 border-slate-100',
  }
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border', colors[color], color === 'gold' && 'bg-[#CAA15F]/10', className)}>
      {children}
    </span>
  )
}

// ── Card ─────────────────────────────────────────────────────────────────────
interface CardProps extends React.HTMLAttributes<HTMLDivElement> { children: React.ReactNode }
export function Card({ children, className, ...props }: CardProps) {
  return (
    <div className={cn('bg-cantara-white rounded-2xl border border-cantara-beige', className)} {...props}>
      {children}
    </div>
  )
}

// ── Input ─────────────────────────────────────────────────────────────────────
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> { label?: string; error?: string }
export function Input({ label, error, className, ...props }: InputProps) {
  return (
    <div className="space-y-1.5">
      {label && <label className="block text-xs font-medium text-slate-600">{label}</label>}
      <input
        className={cn(
          'w-full px-3 py-2 text-sm rounded-lg border border-slate-200 outline-none transition-all',
          'focus:border-cantara-gold focus:ring-2 focus:ring-cantara-gold/20',
          error && 'border-rose-300',
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-rose-500">{error}</p>}
    </div>
  )
}

// ── Select ────────────────────────────────────────────────────────────────────
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> { label?: string; options: { value: string; label: string }[] }
export function Select({ label, options, className, ...props }: SelectProps) {
  return (
    <div className="space-y-1.5">
      {label && <label className="block text-xs font-medium text-slate-600">{label}</label>}
      <select
        className={cn(
          'w-full px-3 py-2 text-sm rounded-lg border border-slate-200 outline-none bg-white transition-all',
          'focus:border-cantara-gold focus:ring-2 focus:ring-cantara-gold/20',
          className
        )}
        {...props}
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

// ── Textarea ──────────────────────────────────────────────────────────────────
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> { label?: string }
export function Textarea({ label, className, ...props }: TextareaProps) {
  return (
    <div className="space-y-1.5">
      {label && <label className="block text-xs font-medium text-slate-600">{label}</label>}
      <textarea
        className={cn(
          'w-full px-3 py-2 text-sm rounded-lg border border-slate-200 outline-none resize-none transition-all',
          'focus:border-cantara-gold focus:ring-2 focus:ring-cantara-gold/20',
          className
        )}
        {...props}
      />
    </div>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, sizeClassName }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode; sizeClassName?: string
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className={cn('relative bg-cantara-white rounded-2xl shadow-2xl w-full max-h-[90vh] overflow-y-auto', sizeClassName ?? 'max-w-lg')}>
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h3 className="text-base font-semibold text-slate-800">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

// ── Progress bar ──────────────────────────────────────────────────────────────
export function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn('w-full h-1.5 bg-slate-100 rounded-full overflow-hidden', className)}>
      <div className="h-full rounded-full transition-all" style={{ width: `${value}%`, background: 'linear-gradient(90deg, #CAA15F, #D37141)' }} />
    </div>
  )
}

// ── GoldLine divider ──────────────────────────────────────────────────────────
export function GoldLine() {
  return <div className="gold-line" />
}

// ── Workstream label ──────────────────────────────────────────────────────────
const WS_LABELS: Record<string, { label: string; color: 'gold' | 'blue' | 'green' | 'red' }> = {
  ws1: { label: 'Workstream 1', color: 'blue' },
  ws2: { label: 'Workstream 2', color: 'green' },
  both: { label: 'WS1 + WS2', color: 'gold' },
  ma: { label: 'M&A', color: 'red' },
}
export function WorkstreamBadge({ ws }: { ws: string | null }) {
  if (!ws) return <Badge color="slate">Not Provisioned</Badge>
  const cfg = WS_LABELS[ws] ?? { label: ws, color: 'slate' as const }
  return <Badge color={cfg.color}>{cfg.label}</Badge>
}
