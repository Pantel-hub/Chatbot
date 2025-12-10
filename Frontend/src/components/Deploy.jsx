// src/components/Deploy.jsx
import React, { useMemo, useState, useEffect } from 'react'
// Στην αρχή του αρχείου
import { BASE_URL, API_ENDPOINTS } from '../config/api';


export default function Deploy({ formData = {}, disabled = false, onPublish, apiKey, widgetScript }) {
  const botId = apiKey || formData.widgetId || formData.botId || 'your-bot-id'
  const primary = formData.primaryColor || '#4f46e5'
  const theme = formData.themeStyle || 'Minimal'
  const position = formData.position || 'Bottom Right'
  const domainInitial = (formData.domain || '').trim()

  const [tab, setTab] = useState('script')
  const [copied, setCopied] = useState('')
  const [published, setPublished] = useState(false)
  const [domains, setDomains] = useState(Array.from(new Set([domainInitial].filter(Boolean))))
  const [newDomain, setNewDomain] = useState('')
  const [calStatus, setCalStatus] = useState('checking') // checking | connected | not_connected | error
  const [calMsg, setCalMsg] = useState('')
  const SERVER_BASE = BASE_URL;
  
  const todayYMD = () => {                //αρχή προσθήκης 1
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth()+1).padStart(2,'0')
    const dd = String(d.getDate()).padStart(2,'0')
    return `${y}-${m}-${dd}`
 }

  const checkCalendarStatus = async () => {
    if (!apiKey) { setCalStatus('not_connected'); return }
    try {
      const res = await fetch(`${BASE_URL}/api/cms/calendar-status`, {
        credentials: 'include'
      })
      if (res.status === 200) {
        const data = await res.json()
        setCalStatus(data.connected ? 'connected' : 'not_connected')
      } else {
        setCalStatus('error')
        setCalMsg(`HTTP ${res.status}`)
      }
    } catch (e) {
      setCalStatus('error'); setCalMsg(e.message || 'Network error')
    }
  }

  const startCalendarOAuth = async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/public/calendar-auth/${apiKey}`, {
        credentials: 'include'
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (data?.auth_url) window.open(data.auth_url, 'gcal', 'width=600,height=700');
      else throw new Error('Missing auth_url')
    } catch (e) {
      setCalStatus('error'); setCalMsg(e.message || 'Could not start OAuth')
    }
  }

  useEffect(() => { checkCalendarStatus() }, [apiKey]) //τέλος προσθηκης1
  
  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data?.type === 'gcal_connected') {
        checkCalendarStatus()
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])



  const posKey = useMemo(() => {
    const p = String(position || '').toLowerCase()
    if (p.includes('κάτω') && p.includes('δεξ')) return 'bottom-right'
    if (p.includes('κάτω') && p.includes('αρισ')) return 'bottom-left'
    if (p.includes('bottom') && p.includes('right')) return 'bottom-right'
    if (p.includes('bottom') && p.includes('left')) return 'bottom-left'
    return 'bottom-right'
  }, [position])

  const configObj = useMemo(() => ({
    botId,
    theme,
    position: posKey,
    primaryColor: primary,
    suggestions: (formData.suggestedPrompts || '')
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean)
      .slice(0, 6),
    greeting: (formData.greeting || "Welcome! I'm your AI assistant. How can I help you today?").trim(),
    botName: (formData.botName || 'AI assistant').trim(),
  }), [botId, theme, posKey, primary, formData.suggestedPrompts, formData.greeting, formData.botName])

  const scriptSnippet = widgetScript || `<script>\n  window.__chatbotConfig = ${JSON.stringify(configObj, null, 2)};\n</script>\n<script src="https://cdn.example.com/chat-widget.min.js" defer></script>`

  const checklist = [
    'Σωστή επιλογή χρώματος/θέματος',
    'Σωστή θέση widget',
    'Το domain έχει προστεθεί στο allowlist',
    'Το script φορτώνει στην τελική σελίδα',
  ]

  const onCopy = async (text, key) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      setTimeout(() => setCopied(''), 1200)
    } catch {}
  }

  const addDomain = () => {
    const d = newDomain.trim()
    if (!d) return
    if (!domains.includes(d)) setDomains(prev => [...prev, d])
    setNewDomain('')
  }

  const removeDomain = (d) => {
    setDomains(prev => prev.filter(x => x !== d))
  }

  const handlePublish = async () => {
    setPublished(true)
    if (onPublish) {
      try { await onPublish({ botId, domains, config: configObj }) } catch {}
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">Deploy</h2>
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-2 text-sm ${published ? 'text-green-600' : 'text-slate-600'}`}>
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: published ? '#16a34a' : '#94a3b8' }} />
            {published ? 'Published' : 'Not published'}
          </span>
          <button
            type="button"
            onClick={handlePublish}
            disabled={disabled}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-white font-medium shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
            style={{ backgroundColor: published ? '#16a34a' : undefined }}
          >
            {published ? 'Published' : 'Publish'}
          </button>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setTab('script')}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium border ${tab === 'script' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-700'}`}
              >
                Script tag
              </button>
            </div>

            <div className="relative">
              <pre className="max-h-[360px] overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6">
                <code className="whitespace-pre-wrap">{scriptSnippet}</code>
              </pre>
              <button
                type="button"
                onClick={() => onCopy(scriptSnippet, 'script')}
                className="absolute right-3 top-3 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {copied === 'script' ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <div className="mb-3 text-sm font-semibold text-slate-700">Checklist</div>
            <ul className="space-y-2 text-sm text-slate-700">
              {checklist.map((c, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-1 h-2 w-2 rounded-full" style={{ backgroundColor: primary }} />
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 p-4">
            <div className="mb-2 text-sm font-semibold text-slate-700">Widget Config</div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="text-slate-500">API Key</div>
              <button
                type="button"
                onClick={() => onCopy(apiKey || '', 'apikey')}
                className="text-sm font-medium text-indigo-600 hover:text-indigo-800 underline cursor-pointer text-left"
              >
                {copied === 'apikey' ? 'Copied!' : 'Copy API Key'}
              </button>
              <div className="text-slate-500">Theme</div>
              <div className="font-medium text-slate-800">{theme}</div>
              <div className="text-slate-500">Position</div>
              <div className="font-medium text-slate-800">{posKey}</div>
              <div className="text-slate-500">Primary</div>
              <div className="font-medium text-slate-800">{primary}</div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <div className="mb-2 text-sm font-semibold text-slate-700">Allowed Domains</div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                placeholder="example.com"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={addDomain}
                className="rounded-lg bg-indigo-600 px-3 py-2 text-white font-medium shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                Add
              </button>
            </div>
            {/* Google Calendar panel */}
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-700">Google Calendar</div>
                <span className="text-xs">
                  {calStatus === 'checking' && <span className="text-slate-500">Έλεγχος…</span>}
                  {calStatus === 'connected' && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                      Συνδεδεμένο
                    </span>
        )}
                  {calStatus === 'not_connected' && (
                    <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
                      Μη συνδεδεμένο
                    </span>
      )}
                  {calStatus === 'error' && <span className="text-rose-600">Σφάλμα</span>}
                </span>
              </div>

              <p className="text-xs text-slate-600 mb-3">
                Συνδέστε το Google Calendar (μία φορά). Μετά το bot θα κλείνει ραντεβού αυτόματα.
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={startCalendarOAuth}
                  disabled={!apiKey}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  {calStatus === 'connected' ? 'Επανασύνδεση' : 'Σύνδεση με Google Calendar'}
                </button>

                <button
                  type="button"
                  onClick={checkCalendarStatus}
                  className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                  title="Ανανέωση κατάστασης"
       >
                  Έλεγχος
                </button>
              </div>

              {calStatus === 'error' && (
                <div className="mt-2 text-xs text-rose-600">Λεπτομέρειες: {calMsg}</div>
              )}
              
              {/* Embedded Google Calendar iframe */}
              {calStatus === 'connected' && (
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <div className="text-sm font-semibold text-slate-700 mb-2">Το Ημερολόγιό σας</div>
                  <div className="rounded-lg overflow-hidden border border-slate-200">
                    <iframe 
                      src="https://calendar.google.com/calendar/embed?mode=WEEK&amp;showTitle=0&amp;showNav=1&amp;showDate=1&amp;showPrint=0&amp;showTabs=0&amp;showCalendars=0&amp;showTz=0&amp;height=400&amp;wkst=2&amp;bgcolor=%23ffffff"
                      style={{ borderWidth: 0 }}
                      width="100%"
                      height="400"
                      frameBorder="0"
                      scrolling="no"
                      title="Google Calendar"
                    ></iframe>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    Τα ραντεβού θα εμφανίζονται στο ημερολόγιο "Bot_Bookings"
                  </p>
                </div>
              )}
            </div>


            {domains.length > 0 && (
              <ul className="mt-3 space-y-2">
                {domains.map((d) => (
                  <li key={d} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                    <span className="text-slate-700">{d}</span>
                    <button
                      type="button"
                      onClick={() => removeDomain(d)}
                      className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700" />
        </div>
      </div>
    </div>
  )
}
