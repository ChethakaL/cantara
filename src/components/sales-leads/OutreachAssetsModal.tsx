'use client'

import { useEffect, useState } from 'react'
import { Loader2, Plus, Save, X, Mail, User as UserIcon, Tag, Eye, Code2, Trash2 } from 'lucide-react'
import { Button, Card, Input, Select, Textarea } from '@/components/ui'

type Asset = {
  id?: string; 
  senderUserId?: string | null; 
  senderUser?: { name: string } | null; 
  touch: number; 
  assetType: 'EMAIL' | 'CALL';
  contactType: 'DIRECT' | 'GENERAL'; 
  subject?: string | null; 
  body: string; 
  version: number; 
  active: boolean 
}

function assetLabel(asset: Pick<Asset, 'touch' | 'assetType'>) {
  if (asset.assetType === 'CALL') return asset.touch === 1 ? 'Call 1' : asset.touch === 2 ? 'Call 2' : `Call ${asset.touch}`
  return asset.touch === 1 ? 'Email 1' : asset.touch === 2 ? 'Email 2' : `Email ${asset.touch}`
}

type User = { id: string; name: string; email: string }

function readAdminEmailFromCookie(): string {
  if (typeof document === 'undefined') return ''
  try {
    const cookies = document.cookie.split('; ')
    const cookie = cookies.find(c => c.startsWith('cantara_admin_email='))
    if (!cookie) return ''
    return decodeURIComponent(cookie.split('=').slice(1).join('=')).trim()
  } catch {
    return ''
  }
}

function resolveCurrentUserId(apiId: string | null | undefined, users: User[]): string | null {
  if (apiId) return apiId
  const email = readAdminEmailFromCookie().toLowerCase()
  if (!email) return null
  return users.find(user => user.email.toLowerCase() === email)?.id || null
}

function filterAssets(
  list: Asset[],
  assetTypeFilter: 'ALL' | 'EMAIL' | 'CALL',
  senderFilter: string,
  sequenceFilter: string,
  currentUserId: string | null,
) {
  return list
    .filter(asset =>
      (assetTypeFilter === 'ALL' || asset.assetType === assetTypeFilter) &&
      (senderFilter === 'CURRENT'
        ? (!asset.senderUserId || (!!currentUserId && asset.senderUserId === currentUserId))
        : senderFilter === 'ALL' || (asset.senderUserId || 'GENERIC') === senderFilter) &&
      (sequenceFilter === 'ALL' || String(asset.touch) === sequenceFilter)
    )
    .slice()
    .sort((a, b) =>
      a.touch - b.touch ||
      a.assetType.localeCompare(b.assetType) ||
      a.contactType.localeCompare(b.contactType) ||
      (a.senderUser?.name || '').localeCompare(b.senderUser?.name || '')
    )
}

export default function OutreachAssetsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [assets, setAssets] = useState<Asset[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [editing, setEditing] = useState<Asset | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor')
  const [assetTypeFilter, setAssetTypeFilter] = useState<'ALL' | 'EMAIL' | 'CALL'>('ALL')
  // Default to all senders so Email + Call templates are visible without hunting filters.
  const [senderFilter, setSenderFilter] = useState('ALL')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [sequenceFilter, setSequenceFilter] = useState('ALL')

  const load = async () => {
    setLoading(true)
    setError('')
    try { 
      const res = await fetch('/api/sales-leads/assets', { cache: 'no-store', credentials: 'same-origin' })
      if (!res.ok) throw new Error('Could not load assets')
      const data = await res.json()
      const list: Asset[] = data.assets || []
      const userList: User[] = data.users || []
      const me = resolveCurrentUserId(data.currentUserId, userList)
      setAssets(list)
      setUsers(userList)
      setCurrentUserId(me)
      const visible = filterAssets(list, assetTypeFilter, senderFilter, sequenceFilter, me)
      setEditing(prev => {
        if (prev?.id) {
          const stillThere = list.find(a => a.id === prev.id)
          if (stillThere) return stillThere
        }
        return visible[0] || list[0] || null
      })
    } catch (err: any) { 
      setError(err.message) 
    } finally { 
      setLoading(false) 
    }
  }

  useEffect(() => { 
    if (isOpen) void load() 
  }, [isOpen])

  if (!isOpen) return null

  const startNew = () => {
    const newAsset: Asset = {
      touch: 1,
      assetType: 'EMAIL',
      contactType: 'DIRECT',
      body: '',
      subject: '',
      version: 1,
      active: true,
      senderUserId: currentUserId,
    }
    setEditing(newAsset)
    setActiveTab('editor')
  }

  const save = async () => { 
    if (!editing) return
    setSaving(true)
    setError('')
    try { 
      const res = await fetch('/api/sales-leads/assets', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        credentials: 'same-origin',
        body: JSON.stringify(editing) 
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Could not save asset')
      const saved = await res.json()
      await load()
      if (saved.asset) setEditing(saved.asset)
    } catch (err: any) { 
      setError(err.message) 
    } finally { 
      setSaving(false) 
    } 
  }

  const removeAsset = async (asset: Asset) => {
    if (!asset.id) {
      setEditing(null)
      return
    }
    const label = `${assetLabel(asset)} (${asset.contactType === 'DIRECT' ? 'Direct Owner' : 'General Inbox'})`
    if (!window.confirm(`Delete "${label}"? This cannot be undone.`)) return
    setDeleting(true)
    setError('')
    try {
      const res = await fetch(`/api/sales-leads/assets?id=${encodeURIComponent(asset.id)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Could not delete template')
      const remaining = assets.filter(a => a.id !== asset.id)
      setAssets(remaining)
      const visible = filterAssets(remaining, assetTypeFilter, senderFilter, sequenceFilter, currentUserId)
      setEditing(prev => (prev?.id === asset.id ? (visible[0] || null) : prev))
    } catch (err: any) {
      setError(err.message)
    } finally {
      setDeleting(false)
    }
  }

  const selectedSender = users.find(u => u.id === editing?.senderUserId)
  const visibleAssets = filterAssets(assets, assetTypeFilter, senderFilter, sequenceFilter, currentUserId)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      
      <Card className="relative w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden bg-slate-50 shadow-2xl border-0 rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">Outreach Assets & Templates</h2>
              <p className="text-xs text-slate-500">Configure sender profiles, touch sequences, and rich email body templates.</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError('')} className="text-rose-400 hover:text-rose-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
            <span className="text-xs text-slate-400 font-medium">Loading templates...</span>
          </div>
        ) : (
          <div className="grid md:grid-cols-[340px_1fr] flex-1 min-h-0 overflow-hidden">
            
            {/* Sidebar Assets List */}
            <div className="bg-white border-r border-slate-200/80 p-4 flex flex-col gap-3 overflow-y-auto">
              <div className="flex flex-wrap items-center justify-between gap-2 px-1 pb-2 border-b border-slate-100">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Saved Templates</span>
                <button
                  type="button"
                  onClick={startNew}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white shadow-sm transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Template</span>
                </button>
              </div>

              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-2 pb-1">
                  <Select value={assetTypeFilter} onChange={e => setAssetTypeFilter(e.target.value as typeof assetTypeFilter)} className="text-[10px] h-8 py-1">
                    <option value="ALL">All Types</option><option value="EMAIL">Email</option><option value="CALL">Call</option>
                  </Select>
                  <Select value={sequenceFilter} onChange={e => setSequenceFilter(e.target.value)} className="text-[10px] h-8 py-1">
                    <option value="ALL">All Steps</option><option value="1">1</option><option value="2">2</option>
                  </Select>
                  <Select value={senderFilter} onChange={e => setSenderFilter(e.target.value)} className="text-[10px] h-8 py-1">
                    <option value="CURRENT">My Assets</option><option value="ALL">All Senders</option><option value="GENERIC">Generic</option>
                    {users.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}
                  </Select>
                </div>
                {visibleAssets.map(asset => {
                  const isSelected = editing?.id === asset.id || (!editing?.id && asset === editing)
                  return (
                    <div
                      key={asset.id || `${asset.assetType}-${asset.touch}-${asset.contactType}-${asset.senderUserId || 'generic'}`}
                      className={`relative w-full text-left rounded-xl p-3.5 transition-all border group ${
                        isSelected 
                          ? 'border-amber-400 bg-amber-50/50 shadow-sm ring-1 ring-amber-400/20' 
                          : 'border-slate-200/70 bg-white hover:border-slate-300 hover:bg-slate-50/80'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setEditing(asset)}
                        className="w-full text-left"
                      >
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="text-xs font-bold text-slate-800">
                            {assetLabel(asset)}
                          </span>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            asset.contactType === 'DIRECT' 
                              ? 'bg-amber-100 text-amber-800' 
                              : 'bg-slate-100 text-slate-600'
                          }`}>
                            {asset.contactType === 'DIRECT' ? 'Direct Owner' : 'General Inbox'}
                          </span>
                        </div>
                        <div className="text-xs font-medium text-slate-600 truncate">
                          {asset.assetType === 'CALL'
                            ? (asset.body?.trim() ? asset.body.trim().slice(0, 72) : '(Empty call script)')
                            : (asset.subject || '(No Subject)')}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-2 flex items-center justify-between">
                          <span className="truncate">{asset.senderUser?.name || 'Generic Sender'}</span>
                          
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 font-medium">v{asset.version}</span>
                            {asset.id && (
                              <button
                                type="button"
                                title="Delete template"
                                disabled={deleting}
                                onClick={e => {
                                  e.stopPropagation()
                                  void removeAsset(asset)
                                }}
                                className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 opacity-70 group-hover:opacity-100 transition-all disabled:opacity-40"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </button>
                    </div>
                  )
                })}

                {!assets.length && (
                  <div className="text-center py-10 text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200 p-4">
                    No templates saved yet. Click "New Template" to create one.
                  </div>
                )}
                {!!assets.length && !visibleAssets.length && (
                  <div className="text-center py-10 text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200 p-4">
                    No templates match these filters. Try <span className="font-semibold text-slate-600">All Senders</span> or type <span className="font-semibold text-slate-600">Call</span>.
                  </div>
                )}
              </div>
            </div>

            {/* Main Editing / Preview Container */}
            {editing ? (
              <div className="flex flex-col bg-slate-50 overflow-y-auto">
                
                {/* Editor Sub-header Bar */}
                <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between sticky top-0 z-10">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-700">Template Editor</span>
                    <span className="text-xs text-slate-400">•</span>
                    <span className="text-xs text-slate-500 font-mono">{assetLabel(editing)} ({editing.contactType})</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="bg-slate-100 p-1 rounded-lg flex gap-1">
                      <button
                        onClick={() => setActiveTab('editor')}
                        className={`flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                          activeTab === 'editor' 
                            ? 'bg-white text-slate-800 shadow-sm' 
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        <Code2 className="w-3.5 h-3.5" /> Edit
                      </button>
                      <button
                        onClick={() => setActiveTab('preview')}
                        className={`flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                          activeTab === 'preview' 
                            ? 'bg-white text-slate-800 shadow-sm' 
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        <Eye className="w-3.5 h-3.5" /> {editing.assetType === 'CALL' ? 'Preview Script' : 'Preview Mail'}
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => void save()}
                      disabled={saving || deleting}
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 text-white shadow-sm transition-all disabled:opacity-50"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{saving ? 'Saving...' : 'Save Template'}</span>
                    </button>
                  </div>
                </div>

                <div className="p-6 space-y-5">
                  {activeTab === 'editor' ? (
                    <>
                      {/* Configuration Grid */}
                      <div className="grid sm:grid-cols-4 gap-4 bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
                        <div>
                          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                            Sequence Asset
                          </label>
                          <Select 
                            value={String(editing.touch)} 
                            onChange={e => setEditing({ ...editing, touch: Number(e.target.value) })}
                            className="bg-slate-50 border-slate-200 text-xs"
                          >
                            <option value="1">Email 1 / Call 1</option>
                            <option value="2">Email 2 / Call 2</option>
                          </Select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Asset Type</label>
                          <Select value={editing.assetType} onChange={e => setEditing({ ...editing, assetType: e.target.value as Asset['assetType'] })} className="bg-slate-50 border-slate-200 text-xs">
                            <option value="EMAIL">Email</option>
                            <option value="CALL">Call</option>
                          </Select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                            Target Audience
                          </label>
                          <Select 
                            value={editing.contactType} 
                            onChange={e => setEditing({ ...editing, contactType: e.target.value as Asset['contactType'] })}
                            className="bg-slate-50 border-slate-200 text-xs"
                          >
                            <option value="DIRECT">Direct Business Owner</option>
                            <option value="GENERAL">General / Info Inbox</option>
                          </Select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                            {editing.assetType === 'CALL' ? 'Caller Profile' : 'Sender Profile'}
                          </label>
                          <Select 
                            value={editing.senderUserId || ''} 
                            onChange={e => setEditing({ ...editing, senderUserId: e.target.value || null })}
                            className="bg-slate-50 border-slate-200 text-xs"
                          >
                            <option value="">Generic Fallback Advisor</option>
                            {users.map(user => (
                              <option key={user.id} value={user.id}>
                                {user.name} ({user.email})
                              </option>
                            ))}
                          </Select>
                        </div>
                      </div>

                      {/* Subject Input - Only for EMAIL */}
                      {editing.assetType === 'EMAIL' && (
                        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm space-y-1.5">
                          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                            Subject Line
                          </label>
                          <Input 
                            value={editing.subject || ''} 
                            onChange={e => setEditing({ ...editing, subject: e.target.value })} 
                            placeholder="e.g. A Buyer's Perspective on {{businessName}}" 
                            className="bg-slate-50 border-slate-200 text-sm font-medium focus:bg-white"
                          />
                        </div>
                      )}

                      {/* Body Input */}
                      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                            {editing.assetType === 'CALL' ? 'Call Script & Talking Points' : 'Email Content Body'}
                          </label>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500">
                            <Tag className="w-3 h-3 text-amber-500" />
                            <span>Variables:</span>
                            <span className="font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[10px] font-semibold">&#123;&#123;ownerFirstName&#125;&#125;</span>
                            <span className="font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[10px] font-semibold">&#123;&#123;businessName&#125;&#125;</span>
                            <span className="font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[10px] font-semibold">&#123;&#123;city&#125;&#125;</span>
                          </div>
                        </div>
                        
                        <Textarea 
                          className="min-h-[320px] bg-slate-50/80 border-slate-200 text-slate-800 text-[14px] leading-[1.75] font-sans focus:bg-white focus:border-amber-400 focus:ring-1 focus:ring-amber-400 p-4 rounded-xl shadow-inner transition-colors" 
                          value={editing.body} 
                          onChange={e => setEditing({ ...editing, body: e.target.value })} 
                          placeholder={editing.assetType === 'CALL' ? 'Write voicemail script or call outline...' : 'Write your email body template here...'} 
                        />
                        <p className="text-[11px] text-slate-400 flex items-center justify-between px-1">
                          <span>Press <kbd className="px-1 py-0.5 bg-slate-100 rounded text-[10px] font-mono border">Enter</kbd> twice for double line spacing between paragraphs.</span>
                          <span>{editing.body ? editing.body.split('\n').length : 0} lines</span>
                        </p>
                      </div>
                    </>
                  ) : editing.assetType === 'CALL' ? (
                    /* Styled Call Telephony Script View */
                    <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden">
                      <div className="bg-gradient-to-r from-blue-950 to-slate-900 text-white p-5 space-y-3">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300">
                              <span className="text-base">📞</span>
                            </div>
                            <div>
                              <div className="text-xs text-blue-200 font-medium uppercase tracking-wider">Outbound Call Telephony Brief</div>
                              <div className="text-base font-bold text-white">
                                {assetLabel(editing)} - {editing.contactType === 'DIRECT' ? 'Direct Owner' : 'General Line'}
                              </div>
                            </div>
                          </div>
                          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 bg-blue-500/20 text-blue-200 border border-blue-400/30 rounded-full">
                            Call Script
                          </span>
                        </div>

                        <div className="pt-2 border-t border-blue-800/60 flex items-center justify-between text-xs text-blue-200">
                          <div>Caller: <span className="font-semibold text-white">{selectedSender ? selectedSender.name : 'Cantara Advisor'}</span></div>
                          <div>Target: <span className="font-semibold text-white">{editing.contactType === 'DIRECT' ? '[Owner Direct Phone]' : '[Business Main Line]'}</span></div>
                        </div>
                      </div>

                      <div className="p-6 md:p-8 text-slate-800 text-sm leading-relaxed whitespace-pre-wrap font-sans bg-slate-50/50 min-h-[280px]">
                        {editing.body ? (
                          editing.body
                        ) : (
                          <span className="text-slate-400 italic">No call script body content entered.</span>
                        )}
                      </div>

                      <div className="bg-white border-t border-slate-100 px-6 py-3 text-[11px] text-slate-400 flex items-center justify-between">
                        <span>Cantara Telephony Script Engine</span>
                        <span>Advisor Call Guidance</span>
                      </div>
                    </div>
                  ) : (
                    /* Styled Email Mailbox Preview View */
                    <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden">
                      {/* Email Header */}
                      <div className="bg-slate-50 border-b border-slate-100 p-5 space-y-3">
                        <div className="flex items-center justify-between gap-4">
                          <div className="space-y-1 min-w-0">
                            <div className="text-xs text-slate-400">Subject</div>
                            <div className="text-base font-bold text-slate-900 leading-snug">
                              {editing.subject || '(No Subject specified)'}
                            </div>
                          </div>
                          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded-full">
                            Live Preview
                          </span>
                        </div>

                        <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs text-slate-600">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600 text-xs">
                              {selectedSender ? selectedSender.name[0] : 'C'}
                            </div>
                            <div>
                              <span className="font-semibold text-slate-800">
                                {selectedSender ? selectedSender.name : 'Cantara Advisor'}
                              </span>{' '}
                              <span className="text-slate-400">
                                &lt;{selectedSender ? selectedSender.email : 'advisor@cantarapet.com'}&gt;
                              </span>
                            </div>
                          </div>
                          <div className="text-slate-400 text-[11px]">To: [Lead Owner]</div>
                        </div>
                      </div>

                      {/* Email Body Rendering */}
                      <div className="p-6 md:p-8 text-slate-800 text-sm leading-relaxed whitespace-pre-wrap font-sans bg-white min-h-[300px]">
                        {editing.body ? (
                          editing.body
                        ) : (
                          <span className="text-slate-400 italic">No email body content entered.</span>
                        )}
                      </div>

                      {/* Footer Info */}
                      <div className="bg-slate-50 border-t border-slate-100 px-6 py-3 text-[11px] text-slate-400 flex items-center justify-between">
                        <span>Cantara Outreach Template Engine</span>
                        <span>Rendered with line breaks preserved</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <Mail className="w-12 h-12 stroke-[1.5] mb-2 text-slate-300" />
                <p className="text-sm font-medium">Select a template on the left or create a new one.</p>
              </div>
            )}

          </div>
        )}
      </Card>
    </div>
  )
}
