'use client'

import { useState } from 'react'
import { ShieldCheck, ChevronDown, ChevronUp, Lock, Server, Sparkles, Database } from 'lucide-react'
import { Card } from '@/components/ui'

export function DataPrivacySecurityPolicy({
  defaultOpen = false,
  isOpen: controlledIsOpen,
  onToggle: controlledOnToggle,
  highlighted = false,
}: {
  defaultOpen?: boolean
  isOpen?: boolean
  onToggle?: () => void
  highlighted?: boolean
}) {
  const [internalIsOpen, setInternalIsOpen] = useState(defaultOpen)
  const isExpanded = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen
  const handleToggle = () => {
    if (controlledOnToggle) {
      controlledOnToggle()
    } else {
      setInternalIsOpen(prev => !prev)
    }
  }

  return (
    <Card className={`p-5 transition-all ${highlighted ? 'ring-2 ring-amber-300 shadow-2xl' : ''}`}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
            <ShieldCheck className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Data Privacy &amp; Security</h2>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed max-w-xl">
              We use a modern, cloud-native technology stack hosted on Amazon Web Services (AWS), designed to provide secure and reliable handling of client data.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleToggle}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-xs transition-colors shrink-0 self-start"
          aria-expanded={isExpanded}
        >
          {isExpanded ? (
            <>
              Hide Policy <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
            </>
          ) : (
            <>
              Read Policy Guidelines <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
            </>
          )}
        </button>
      </div>

      {isExpanded && (
        <div className="mt-6 pt-5 border-t border-slate-100 space-y-6 text-xs text-slate-600 leading-relaxed">
          {/* Technology and Infrastructure */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-slate-700" />
              <h3 className="text-sm font-bold text-slate-900">Technology and Infrastructure</h3>
            </div>
            <p>
              Our backend applications are built using Python and FastAPI, with PostgreSQL used for secure data storage. Our front-end applications are developed using Next.js, TypeScript, and React.
            </p>
            <p>
              Where AI-powered analysis is required, we use Anthropic’s Claude models through Amazon Bedrock. This allows AI processing to remain within the AWS environment and be governed by AWS’s enterprise security, data-processing, and regional-control frameworks.
            </p>
            <p>
              User authentication is managed through secure JWT-based sessions, and passwords are salted and hashed using bcrypt. The platform also maintains a built-in audit log to record user activity and changes made within the system.
            </p>
          </div>

          {/* Data Security */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-slate-700" />
              <h3 className="text-sm font-bold text-slate-900">Data Security</h3>
            </div>
            <p>We apply multiple layers of protection to client data:</p>
            <ul className="space-y-1.5 pl-2">
              <li className="flex items-start gap-2">
                <span className="text-amber-600 font-bold">•</span>
                <span>Data at rest is encrypted using AWS RDS encryption with AES-256.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-600 font-bold">•</span>
                <span>Data in transit is encrypted using TLS/HTTPS.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-600 font-bold">•</span>
                <span>Production SSH ports are closed to the public.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-600 font-bold">•</span>
                <span>Administrative server access is restricted to authorized personnel connecting from an approved IP address through a Tailscale VPN.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-600 font-bold">•</span>
                <span>UFW firewalls are enabled across production servers.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-600 font-bold">•</span>
                <span>Fail2Ban actively monitors suspicious login activity and automatically blocks repeated brute-force attempts.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-600 font-bold">•</span>
                <span>Database ports are not publicly accessible; the database can only be reached through the application layer.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-600 font-bold">•</span>
                <span>We monitor relevant security advisories to identify and respond to vulnerabilities affecting our software dependencies.</span>
              </li>
            </ul>
            <p className="pt-1">
              All create, update, and delete operations are recorded in an audit trail that captures the acting user, the action performed, the affected record or entity, and the timestamp.
            </p>
          </div>

          {/* AI Processing and Privacy */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-slate-700" />
              <h3 className="text-sm font-bold text-slate-900">AI Processing and Privacy</h3>
            </div>
            <p>
              When AI-powered analysis is used, the relevant information is processed by Anthropic’s Claude through Amazon Bedrock. Data submitted through Amazon Bedrock is not used to train Anthropic’s underlying models and remains subject to AWS’s applicable data-processing terms and regional controls.
            </p>
            <p>
              AI processing does not require client data to be transferred to a separate consumer-facing AI service or managed outside the AWS environment.
            </p>
          </div>

          {/* Data Retention and Deletion */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-slate-700" />
              <h3 className="text-sm font-bold text-slate-900">Data Retention and Deletion</h3>
            </div>
            <p>
              Client records are retained within our database until deletion is requested by the client or an authorized user, unless a different retention period is established by contract or required by law.
            </p>
            <p>
              Our platform supports complete data-deletion workflows. When an authorized deletion request is processed, deletion cascades through associated records—including analyses, briefs, feedback, and other related data—to support applicable privacy and data-protection requirements.
            </p>
          </div>
        </div>
      )}
    </Card>
  )
}
