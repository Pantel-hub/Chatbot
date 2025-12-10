// src/components/Test.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline'
import { BASE_URL, API_ENDPOINTS } from '../config/api';
import ReactMarkdown from 'react-markdown'

export default function Test({ formData, chatbotId, serverUrl = API_ENDPOINTS.chat }) {
  const { t } = useTranslation()

  const primary = formData?.primaryColor || '#4f46e5'
  const botName = (formData?.botName || '').trim() || t('test.defaults.botName')
  const greetingRaw = (formData?.greeting || '').trim() || t('test.defaults.greeting')

  // Replace placeholder with bot name if present
  const effectiveGreeting = useMemo(() => {
    const placeholder = t('test.defaults.placeholderInGreeting')
    return greetingRaw.includes(placeholder)
      ? greetingRaw.replace(placeholder, botName)
      : greetingRaw
  }, [greetingRaw, botName, t])

  const suggestions = useMemo(() => {
    const raw = formData?.suggestedPrompts || ''
    return raw.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 6)
  }, [formData?.suggestedPrompts])

  const [messages, setMessages] = useState([])
  const [value, setValue] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const scrollRef = useRef(null)
  //const [threadId, setThreadId] = useState(null)

  // Initialize greeting
  useEffect(() => {
    setMessages([{ from: 'bot', text: effectiveGreeting }])
    setIsTyping(false)
  }, [effectiveGreeting])

  // Auto scroll
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, isTyping])

    useEffect(() => {
      return () => {
        // Cleanup function που τρέχει όταν το component unmount
        if (chatbotId) {
          fetch(API_ENDPOINTS.cleanupTestSession, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json' 
            },
            credentials: 'include', // Cookie για authentication
            body: JSON.stringify({ 
              chatbot_id: chatbotId,
            })
          }).catch(err => {
            // Silent fail - δεν θέλουμε να κάνουμε error το UI
            console.warn('Cleanup failed:', err)
          })
        }
      }
    }, [chatbotId])

  const clearChat = () => {
    setMessages([{ from: 'bot', text: effectiveGreeting }])
    setValue('')
    setIsTyping(false)
  }

  const pushUser = (text) => {
    setMessages(prev => [...prev, { from: 'user', text }])
  }

  // Streaming via fetch (SSE-like) with incremental update
  const sendToServer = async (text) => {
    //console.log('🚀 [Test.jsx] Sending message to backend:');
    //console.log('   message:', text);
    //console.log('   thread_id:', threadId);  // 👈 Αυτό θέλουμε να δούμε!
    //console.log('   chatbot_id:', chatbotId);

    try {
      const response = await fetch(serverUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', 
        body: JSON.stringify({
          message: text,
          ...(chatbotId ? { chatbot_id: chatbotId } : {})
})

      })

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required')
        }
        throw new Error('Bad response')
      }

      if (!response.body) {
        throw new Error('No response body')
      }
      console.log('📋 [Test.jsx] Response headers:');
      //console.log('   X-Thread-ID:', response.headers.get('X-Thread-ID'));
      console.log('   All headers:', [...response.headers.entries()])
      
      //διάβασμα του header για thread_id
      //const threadIdFromHeader = response.headers.get('X-Thread-ID');
      //if (threadIdFromHeader) {
        //console.log('📌 Received thread_id from backend:', threadIdFromHeader);
        //console.log('   Current threadId state:', threadId);
        
        // Αν δεν έχουμε ήδη thread_id, κράτα το
        //if (!threadId) {
          //setThreadId(threadIdFromHeader);
          //console.log('✅ [Test.jsx] Updated threadId state to:', threadIdFromHeader);
        //}
      //}
      // Create placeholder bot message to stream into
      const botMessageId = Date.now() + Math.random()
      setMessages(prev => [...prev, { id: botMessageId, from: 'bot', text: '' }])

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')
        for (const line of lines) {
          const l = line.trim()
          if (!l) continue
          if (l.startsWith('data:')) {
            const data = l.slice(5).trim()
            if (data === '[DONE]') break
            try {
              const parsed = JSON.parse(data)
              if (typeof parsed.response === 'string') {
                const chunkText = parsed.response; // server-side καθάρισμα citations, δεν αγγίζουμε εδώ
                setMessages(prev => prev.map(msg => {
                  if (msg.id === botMessageId) {
                    const newText = (msg.text || '') + chunkText;
                    // για προβολή κρύβουμε ό,τι ακολουθεί από το πρώτο <action>...</action>
                    const displayText = newText.replace(/<\s*action\b[^>]*>[\s\S]*$/i, '').trim();
                    const hasAction = /<\s*action\b[^>]*>[\s\S]*?<\s*\/\s*action\s*>/i.test(newText);
                    return { ...msg, text: newText, displayText, hasAction };
                  }
                  return msg;
                }))
              }
              // Προσθήκη warning message αν υπάρχει action block
              
            } catch {
              // non-JSON line; append as plain text
              setMessages(prev => prev.map(msg => (
                msg.id === botMessageId ? { ...msg, text: msg.text + data } : msg
              )))
            }
          }
        }
      }
      setMessages(prev => prev.map(msg => {
        if (msg.id === botMessageId && msg.text) {
          const result = parseActionBlocks(msg.text);
          return {
            ...msg,
            text: result.cleanedText,
            displayText: result.cleanedText,
            hasAction: result.hasAction,
            actionType: result.actionType
          };
        }
        return msg;
      }));
      
      // Add warning if action was detected
      setMessages(prev => {
        const botMsg = prev.find(m => m.id === botMessageId);
        if (botMsg?.hasAction && !prev.some(m => m.from === 'warning')) {
          return [...prev, { id: Date.now(), from: 'warning' }];
        }
        return prev;
      });
    } catch (e) {
      setMessages(prev => [...prev, { from: 'bot', text: t('test.errors.network') }])
    } finally {
      setIsTyping(false)
    }
  }

  const handleSend = (e) => {
    e?.preventDefault?.()
    const text = value.trim()
    if (!text) return
    pushUser(text)
    setValue('')
    setIsTyping(true)
    sendToServer(text)
  }

  const handleSuggestionClick = (s) => {
    pushUser(s)
    setIsTyping(true)
    sendToServer(s)
  }

  const statusDot = '#16a34a'
  
  // Parse and handle action blocks (similar to widget logic)
  const parseActionBlocks = (fullText) => {
    const actionMatch = fullText.match(/<\s*action\b[^>]*>([\s\S]*?)<\s*\/\s*action\s*>/i);
    if (actionMatch) {
      try {
        const actionData = JSON.parse(actionMatch[1]);
        console.log('🔍 ACTION detected in test mode:', actionData.type);
        // In test mode, we don't execute actions - just return cleaned text
        return {
          cleanedText: fullText.replace(/<\s*action\b[^>]*>[\s\S]*?<\s*\/\s*action\s*>/i, '').trim(),
          hasAction: true,
          actionType: 'unknown'
        };

      } catch (e) {
        console.warn('Failed to parse ACTION block:', e);
        return {
          cleanedText: fullText.replace(/<ACTION>.*?<\/ACTION>/s, '').trim(),
          hasAction: true,
          actionType: 'unknown'
        };
      }
    }
    return { cleanedText: fullText, hasAction: false };
  }
  
  

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-6 shadow-sm">
      {/* Header */}
      <div className="mb-3 md:mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h2 className="text-xl md:text-2xl font-semibold text-slate-900">{t('test.title')}</h2>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <span className="inline-flex items-center gap-2 text-xs sm:text-sm text-slate-600">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: statusDot }} />
            {t('test.liveMode')}
          </span>
          <button
            type="button"
            onClick={clearChat}
            className="rounded-lg border border-slate-200 bg-white px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {t('test.clearChat')}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
        {/* Greeting state */}
        {messages.length === 1 && (
          <div className="mb-4 flex flex-col items-center text-center">
            <div className="mb-3 grid h-10 w-10 sm:h-12 sm:w-12 place-items-center rounded-full bg-slate-200 text-slate-500">
              <svg viewBox="0 0 24 24" className="h-6 w-6 sm:h-7 sm:w-7"><path fill="currentColor" d="M12 2a1 1 0 011 1v1h3a2 2 0 012 2v1h1a1 1 0 110 2h-1v5a4 4 0 01-4 4h-6a4 4 0 01-4-4V9H5a1 1 0 110-2h1V6a2 2 0 012-2h3V3a1 1 0 011-1zM7 13a1 1 0 100 2h1a1 1 0 100-2H7zm9 0h-1a1 1 0 100 2h1a1 1 0 100-2z" /></svg>
            </div>
            <p className="text-sm sm:text-base text-slate-600">{effectiveGreeting}</p>
          </div>
        )}

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <>
            <div className="mb-2 text-center text-xs sm:text-sm font-medium text-slate-600">{t('test.suggestions.title')}</div>
            <div className="mb-4 space-y-2 sm:space-y-3">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSuggestionClick(s)}
                  className="flex w-full items-center gap-2 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-left text-slate-700 hover:bg-indigo-50"
                  style={{ boxShadow: 'inset 0 0 0 1px rgba(99,102,241,0.15)' }}
                >
                  <ChatBubbleLeftRightIcon className="h-5 w-5 text-indigo-400" />
                  <span className="truncate">{s}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Messages */}
        <div
          ref={scrollRef}
          className="mb-4 max-h-[260px] sm:max-h-[340px] min-h-[120px] sm:min-h-[140px] overflow-y-auto rounded-lg border border-slate-200 bg-white p-3"
        >

          {messages.map((m, idx) => {
            const isUser = m.from === 'user'
            const isWarning = m.from === 'warning'
            
            // Warning message
            if (isWarning) {
              return (
                <div key={m.id ?? idx} className="mb-3 flex justify-center">
                  <div className="max-w-[90%] rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs sm:text-sm">
                    <div className="flex items-start gap-2">
                      <span className="text-lg">⚠️</span>
                      <div className="flex-1">
                        <div className="font-semibold text-amber-900 mb-0.5">Test Preview Mode</div>
                        <div className="text-amber-800 leading-relaxed">
                          Οι φόρμες επικοινωνίας και ραντεβού δεν είναι διαθέσιμες εδώ. Δοκιμάστε το widget στην ιστοσελίδα σας.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            }
  
  
            return (
              <div key={m.id ?? idx} className={`mb-2 flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] sm:max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm ${isUser ? 'text-white' : 'bg-slate-100 text-slate-800'}`}
                  style={isUser ? { backgroundColor: primary } : {}}
                >
                  {isUser ? (
                    m.text
                  ) : (
                    <ReactMarkdown
                      components={{
                        p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                        ul: ({node, ...props}) => <ul className="list-disc ml-4 mb-2" {...props} />,
                        code: ({node, inline, ...props}) => 
                          inline ? (
                            <code className="bg-slate-200 px-1 rounded text-xs" {...props} />
                          ) : (
                            <code className="block bg-slate-200 p-2 rounded my-2 text-xs" {...props} />
                          ),
                        strong: ({node, ...props}) => <strong className="font-semibold" {...props} />,
                        a: ({node, ...props}) => <a className="underline" target="_blank" rel="noopener noreferrer" {...props} />,
                      }}
                    >
                      {m.displayText || m.text}
                    </ReactMarkdown>
                  )}
                </div>
              </div>
            )
          })}
          {isTyping && (
            <div className="mt-1 flex items-center gap-2 text-[11px] sm:text-xs text-slate-500">
              <span className="h-2 w-2 animate-pulse rounded-full" style={{ backgroundColor: primary }} />
              {t('test.typingIndicator')}
            </div>
          )}
        </div>

        {/* Input */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend(e)
              }
            }}
            placeholder={t('test.inputPlaceholder')}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="button"
            onClick={handleSend}
            className="w-full sm:w-auto rounded-lg px-4 sm:px-5 py-2 font-medium text-white shadow-sm hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            style={{ backgroundColor: primary }}
          >
            {t('test.sendButton')}
          </button>
        </div>
      </div>

      {/* Info box */}
      <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50 p-3 sm:p-4 text-xs sm:text-sm text-slate-700">
        <span className="font-semibold">{t('test.infoBox.title')}</span> {t('test.infoBox.body')}
      </div>
    
      {/* Forms Warning Box */}
      <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-3 sm:p-4">
        <div className="flex items-start gap-3">
          <svg className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
          </svg>
          <div className="flex-1">
            <h4 className="font-semibold text-blue-900 text-sm mb-1">
              ℹ️ {t('test.formsInfo.title')}
            </h4>
            <p className="text-xs sm:text-sm text-blue-800 leading-relaxed">
              {t('test.formsInfo.body')}
            </p>
          </div>
        </div>
      </div>
    </div>  
  )
}
