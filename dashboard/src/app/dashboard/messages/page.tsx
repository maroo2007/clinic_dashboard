'use client'
import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { api } from '@/lib/api'
import { getSocket } from '@/lib/socket'
import { toast } from 'sonner'
import { MessageSquare, Send, Search, Loader2, Phone, ArrowDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Message } from '@/lib/types'

function fmt(ts: string) {
  const d = new Date(ts)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  return sameDay
    ? d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function fmtFull(ts: string) {
  return new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

interface Convo {
  phone: string
  patientName: string | null
  patientId: number | null
  latestMsg: Message
  msgCount: number
}

export default function MessagesPage() {
  const [allMessages, setAllMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [live, setLive] = useState(false)
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [sending, setSending] = useState(false)
  const [draft, setDraft] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const fetchMessages = useCallback(async () => {
    try {
      const res = await api.get('/messages?limit=500&page=1')
      const msgs = (res.data.data ?? []) as Message[]
      setAllMessages(msgs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()))
    } catch (err) {
      console.error('[Messages] fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchMessages() }, [fetchMessages])

  // Socket.io realtime messages
  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    const onNew = (msg: Message) => {
      setAllMessages(prev => {
        if (prev.find(m => m.id === msg.id)) return prev
        return [msg, ...prev]
      })
    }

    socket.on('message:new', onNew)
    socket.on('connect', () => setLive(true))
    socket.on('disconnect', () => setLive(false))
    setLive(socket.connected)

    return () => {
      socket.off('message:new', onNew)
      socket.off('connect')
      socket.off('disconnect')
    }
  }, [])

  // Auto-scroll when new message arrives in selected conversation
  useEffect(() => {
    if (selectedPhone) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [allMessages, selectedPhone])

  const conversations: Convo[] = useMemo(() => {
    const map = new Map<string, Message[]>()
    allMessages.forEach(m => {
      const key = m.phone ?? 'unknown'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(m)
    })
    return Array.from(map.entries())
      .map(([phone, msgs]) => {
        const sorted = msgs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        const latest = sorted[0]
        return {
          phone,
          patientName: latest.patient?.name ?? null,
          patientId: latest.patient?.id ?? null,
          latestMsg: latest,
          msgCount: msgs.length,
        }
      })
      .filter(c => !search || c.phone.includes(search) || c.patientName?.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => new Date(b.latestMsg.timestamp).getTime() - new Date(a.latestMsg.timestamp).getTime())
  }, [allMessages, search])

  const chatMessages = useMemo(() => {
    if (!selectedPhone) return []
    return allMessages
      .filter(m => m.phone === selectedPhone)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  }, [allMessages, selectedPhone])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!draft.trim() || !selectedPhone) return
    const selectedConvo = conversations.find(c => c.phone === selectedPhone)

    setSending(true)
    try {
      await api.post('/messages/send', {
        to: selectedPhone,
        text: draft.trim(),
        patient_id: selectedConvo?.patientId ?? undefined,
      })
      setDraft('')
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to send message')
    } finally {
      setSending(false)
    }
  }

  const selectedConvo = conversations.find(c => c.phone === selectedPhone)

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#09090b' }}>
      {/* ── Conversation list ── */}
      <div className="w-80 shrink-0 flex flex-col border-r border-zinc-800" style={{ background: '#111113' }}>
        <div className="px-4 pt-6 pb-3">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-base font-semibold text-white">Messages</h1>
            <div className="flex items-center gap-1.5">
              <span className={cn('w-1.5 h-1.5 rounded-full', live ? 'bg-green-400 animate-pulse' : 'bg-zinc-600')} />
              <span className={cn('text-xs', live ? 'text-green-400' : 'text-zinc-500')}>
                {live ? 'Live' : 'Connecting'}
              </span>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or phone…"
              className="w-full pl-8 pr-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 text-zinc-500 animate-spin" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <MessageSquare className="w-8 h-8 text-zinc-700 mb-2" />
              <p className="text-zinc-500 text-sm">No conversations yet</p>
            </div>
          ) : (
            conversations.map(convo => (
              <button key={convo.phone} onClick={() => setSelectedPhone(convo.phone)}
                className={cn(
                  'w-full flex items-start gap-3 px-4 py-3 text-left transition-colors border-b border-zinc-800/50',
                  selectedPhone === convo.phone
                    ? 'bg-blue-600/15 border-l-2 border-l-blue-500'
                    : 'hover:bg-zinc-800/50',
                )}>
                <div className="w-9 h-9 rounded-full bg-zinc-700 flex items-center justify-center shrink-0 mt-0.5">
                  {convo.patientName ? (
                    <span className="text-xs font-semibold text-zinc-300">
                      {convo.patientName.split(' ').map(n => n[0]).slice(0, 2).join('')}
                    </span>
                  ) : (
                    <Phone className="w-4 h-4 text-zinc-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="text-sm font-medium text-white truncate">
                      {convo.patientName ?? convo.phone}
                    </p>
                    <span className="text-xs text-zinc-500 shrink-0 ml-1">{fmt(convo.latestMsg.timestamp)}</span>
                  </div>
                  {convo.patientName && (
                    <p className="text-xs text-zinc-500 truncate mb-0.5">{convo.phone}</p>
                  )}
                  <p className="text-xs text-zinc-500 truncate">{convo.latestMsg.message}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ── Chat window ── */}
      {selectedPhone && selectedConvo ? (
        <div className="flex-1 flex flex-col">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-zinc-800 shrink-0" style={{ background: '#111113' }}>
            <div className="w-9 h-9 rounded-full bg-zinc-700 flex items-center justify-center">
              {selectedConvo.patientName ? (
                <span className="text-xs font-semibold text-zinc-300">
                  {selectedConvo.patientName.split(' ').map(n => n[0]).slice(0, 2).join('')}
                </span>
              ) : (
                <Phone className="w-4 h-4 text-zinc-400" />
              )}
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{selectedConvo.patientName ?? selectedPhone}</p>
              <p className="text-xs text-zinc-500">{selectedPhone}</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
            {chatMessages.map((msg, i) => {
              const isOut = msg.direction === 'outbound'
              const prev = chatMessages[i - 1]
              const showDate = !prev || new Date(msg.timestamp).toDateString() !== new Date(prev.timestamp).toDateString()

              return (
                <div key={msg.id}>
                  {showDate && (
                    <div className="flex items-center gap-3 my-4">
                      <div className="flex-1 h-px bg-zinc-800" />
                      <span className="text-xs text-zinc-500 px-2">
                        {new Date(msg.timestamp).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </span>
                      <div className="flex-1 h-px bg-zinc-800" />
                    </div>
                  )}
                  <div className={cn('flex', isOut ? 'justify-end' : 'justify-start')}>
                    <div className={cn(
                      'max-w-[70%] rounded-2xl px-4 py-2.5 text-sm',
                      isOut ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-zinc-800 text-zinc-100 rounded-bl-sm',
                    )}>
                      <p className="leading-relaxed break-words">{msg.message}</p>
                      <p className={cn('text-xs mt-1', isOut ? 'text-blue-200/70 text-right' : 'text-zinc-500')}>
                        {fmtFull(msg.timestamp)}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>

          <div className="px-6 py-4 border-t border-zinc-800 shrink-0" style={{ background: '#111113' }}>
            <form onSubmit={handleSend} className="flex items-end gap-3">
              <textarea value={draft} onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e) } }}
                placeholder="Type a message…" rows={1}
                className="flex-1 px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 resize-none transition-colors"
                style={{ maxHeight: '120px' }} />
              <button type="submit" disabled={!draft.trim() || sending}
                className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors shrink-0">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
          <div className="w-16 h-16 rounded-2xl bg-zinc-800 flex items-center justify-center mb-4">
            <ArrowDown className="w-7 h-7 text-zinc-500" />
          </div>
          <h3 className="text-white font-semibold mb-1">Select a conversation</h3>
          <p className="text-zinc-500 text-sm">Choose a conversation from the left to start messaging</p>
        </div>
      )}
    </div>
  )
}
