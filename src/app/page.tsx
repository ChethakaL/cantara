'use client'
import Link from 'next/link'
import { ArrowRight, Shield, TrendingUp, FileSearch } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0d1829' }}>
      {/* Nav */}
      <nav className="px-8 py-5 flex items-center justify-between">
        <span className="text-white cantara-serif text-xl tracking-[0.15em]">Cantara</span>
        <div className="flex gap-3">
          <Link href="/login/client" className="text-white/40 hover:text-white/70 text-sm px-4 py-2 transition-colors">Client Login</Link>
          <Link href="/login/admin" className="text-sm px-4 py-2 rounded" style={{ background: 'rgba(184,146,42,0.15)', color: '#d4a843', border: '1px solid rgba(184,146,42,0.3)' }}>
            Advisor Login
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center py-24">
        <div className="mb-6 inline-block px-4 py-1.5 rounded-full text-xs tracking-[0.2em] uppercase" style={{ background: 'rgba(184,146,42,0.1)', color: '#d4a843', border: '1px solid rgba(184,146,42,0.2)' }}>
          Business Sale Readiness & M&A Advisory
        </div>
        <h1 className="text-5xl md:text-6xl font-light text-white cantara-serif mb-6 max-w-3xl leading-tight">
          Prepare Your Business.<br />
          <span style={{ color: '#d4a843' }}>Maximize Your Exit.</span>
        </h1>
        <p className="text-slate-400 max-w-xl text-lg font-light leading-relaxed mb-10">
          A structured, advisor-guided process for pet resort owners ready to sell — from readiness assessment through M&A execution.
        </p>
        <div className="flex gap-4 flex-wrap justify-center">
          <Link href="/login/client" className="flex items-center gap-2 px-6 py-3 rounded text-sm font-medium text-white transition-all hover:opacity-90" style={{ background: 'linear-gradient(135deg, #b8922a, #d4a843)' }}>
            Access Client Portal <ArrowRight className="w-4 h-4" />
          </Link>
          <Link href="/login/admin" className="flex items-center gap-2 px-6 py-3 rounded text-sm font-medium text-white/60 hover:text-white/90 transition-colors" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
            Advisor Sign In
          </Link>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-24 max-w-4xl w-full text-left">
          {[
            { icon: Shield, title: 'Workstream 1', desc: 'Risk mitigation — identify and resolve issues before they become deal-breakers.' },
            { icon: TrendingUp, title: 'Workstream 2', desc: 'Profitability & growth — demonstrate value and optimize financials for maximum valuation.' },
            { icon: FileSearch, title: 'M&A Process', desc: 'Full transaction management from CIM preparation through closing.' },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="p-6 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="w-8 h-8 rounded flex items-center justify-center mb-4" style={{ background: 'rgba(184,146,42,0.12)' }}>
                <Icon className="w-4 h-4" style={{ color: '#d4a843' }} />
              </div>
              <h3 className="text-white font-medium text-sm mb-2 cantara-serif">{title}</h3>
              <p className="text-slate-500 text-sm font-light leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="py-6 text-center text-slate-600 text-xs">
        © 2026 Pollack Strategy Corp dba Cantara Pet Advisors · Powered by Babalilm AI FZ-LLC
      </footer>
    </div>
  )
}
