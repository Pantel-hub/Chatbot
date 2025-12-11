// src/Dashboard.jsx
import React, { useEffect, useMemo, useState, useId } from 'react';
import {
  Globe,
  Download,
  BarChart3,
  Bot,
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Play,
  Pause,
  Trash2,
  LogOut,
  Edit3,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  Legend,
} from 'recharts';

import Analytics from './Analytics';
import { API_ENDPOINTS } from '../config/api';


function Card({ children, className = '' }) {
  return (
    <div className={`rounded-2xl border border-gray-200 bg-white/80 backdrop-blur shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function Section({ title, icon: Icon, right, children }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4 border-b border-gray-200/80 bg-gradient-to-b from-white to-gray-50">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-5 w-5 text-indigo-600" />}
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        </div>
        {right}
      </div>
      <div className="p-5">{children}</div>
    </Card>
  );
}

export default function Dashboard({ onLogout, onEditBot, onCreateNewBot, onSelectBot, activeChatbotId }) {
  const { t, i18n } = useTranslation();
  

  // ---------- UI: language toggle ----------
  const toggleLang = () => {
    const next = i18n.language === 'el' ? 'en' : 'el';
    i18n.changeLanguage(next);
  };

  // ---------- My Bots  ----------
  const [bots, setBots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);


  useEffect(() => {
    fetchUserBots();
  }, []);

  const fetchUserBots = async () => {
    try {
      const res = await fetch(API_ENDPOINTS.getUserChatbots, {
        credentials: 'include'
      });
    
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
    
      const data = await res.json();
    
      // Transform API data to UI format
      const transformedBots = data.chatbots.map(bot => ({
        id: bot.id,                  // για React key & routing
        name: bot.botName,
        status: 'active',                   // TODO: προσθήκη status column στη βάση
        createdAt: bot.created_at.split('T')[0], // "2025-01-15T10:30:00" → "2025-01-15"
        //description: bot.description || 'No description',
        tags: bot.industry ? [bot.industry] : [],
        companyName: bot.companyName,
        websiteURL: bot.websiteURL
      }));
    
      setBots(transformedBots);
    } catch (error) {
      console.error('Error fetching bots:', error);
      // TODO: Show user-friendly error message
    } finally {
      setLoading(false);
    }
 };


  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all | active | paused
  const filteredBots = useMemo(() => {
    let list = [...bots];
    if (statusFilter !== 'all') list = list.filter(b => b.status === statusFilter);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        b =>
          b.name.toLowerCase().includes(q) ||
          b.description.toLowerCase().includes(q) ||
          b.tags.some(tg => tg.toLowerCase().includes(q))
      );
    }
    return list;
  }, [bots, query, statusFilter]);

  // ουσιαστικά παίρνει το πιο πρόσφατα δημιουρημένο chatbot και το κάνει ενεργο, αν 
  // δεν υπάρχει άλλο ενεργο
  //αυτό χρησιμευει για το όταν ανοιξει ο χρήστης το dashboard να του δείξει τα bydefault 
  // τα analytics του πιο πρόσφατου chatbot
  useEffect(() => {
    if (!activeChatbotId && filteredBots.length > 0) {
      const latest = [...filteredBots].sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      )[0];
      onSelectBot(latest.id); // ενημερώνει το App
    }
  }, [activeChatbotId, filteredBots, onSelectBot]);


  const toggleBotStatus = (id) => {
    setBots(prev =>
      prev.map(b => (b.id === id ? { ...b, status: b.status === 'active' ? 'paused' : 'active' } : b))
    );
  };

  const handleDelete = async (id) => {
    if (!confirm('Είστε σίγουροι ότι θέλετε να διαγράψετε αυτό το bot;')) return;

    try {
      console.log('[Dashboard] 🗑️ Διαγραφή bot:', id);
      setDeletingId(id);

      const res = await fetch(API_ENDPOINTS.deleteChatbot(id), {
        method: 'DELETE',
        credentials: 'include',
      });

      if (res.status !== 204 && !res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      // Αφαίρεση από λίστα + φροντίδα για activeChatbotId μέσα στο ίδιο update
      setBots((prev) => {
        const next = prev.filter((b) => b.id !== id);
        if (activeChatbotId === id) {
          const newActive = next[0]?.id ?? null;
          onSelectBot(newActive);
          console.log('[Dashboard] 🔄 activeChatbotId μετά το delete ->', newActive);
        }
        return next;
      });

      console.log('[Dashboard] ✅ Διαγράφηκε:', id);
    } catch (err) {
      console.error('[Dashboard] ❌ Αποτυχία διαγραφής:', err);
      alert('Η διαγραφή απέτυχε. Προσπαθήστε ξανά.');
    } finally {
      setDeletingId(null);
    }
  };


  // ---------- UI ----------
  return (
    <div className="w-full p-2 sm:p-4 md:p-6">
      {/* Header */}
      <div className="rounded-2xl sm:rounded-3xl overflow-hidden border border-gray-200 shadow-sm">
        <div className="relative">
          <div className="absolute inset-0 bg-[radial-gradient(1200px_300px_at_20%_-40%,rgba(99,102,241,0.45),transparent),radial-gradient(1200px_300px_at_80%_-40%,rgba(168,85,247,0.45),transparent)]" />
          <div className="relative px-3 sm:px-5 md:px-7 py-4 sm:py-6 md:py-7">
            <div className="flex items-start justify-between">
              <div className="text-gray-900">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-semibold tracking-tight"> {t('dashboard.title', 'Dashboard')} </h1>
                <p className="text-gray-600 text-xs sm:text-sm mt-1">{t('dashboard.subtitle', 'Overview & Analytics')}</p>
              </div>
              <div className="flex items-center gap-1 sm:gap-2">
                <button
                  onClick={toggleLang}
                  className="inline-flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 text-xs sm:text-sm shadow-sm"
                  aria-label="Toggle language"
                >
                  <Globe className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden xs:inline">{i18n.language === 'el' ? 'EN' : 'EL'}</span>
                </button>

                <button
                  onClick={onLogout}
                  className="p-1.5 sm:p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-all duration-200 flex items-center gap-1"
                  aria-label="Logout"
                  title="Logout"
                >
                  <LogOut className="h-3 w-3 sm:h-4 sm:w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        

        {/* Analytics Section */}
        <div className="p-5 bg-gradient-to-b from-white to-gray-50">
          <Analytics
            key={activeChatbotId ?? 'all'}  
            activeChatbotId={activeChatbotId}
            endpoint={
              activeChatbotId
              ? `${API_ENDPOINTS.analytics}?chatbot_id=${activeChatbotId}`
              : API_ENDPOINTS.analytics
            }
          />
        

          {/* My Bots Section */}
          <Section
            title={t('bots.title', 'My Bots')}
            icon={Bot}
            right={
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl border border-gray-300 bg-white">
                  <Search className="h-4 w-4 text-gray-500" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t('bots.search', 'Search bots...')}
                    className="outline-none text-sm bg-transparent placeholder:text-gray-400 w-full min-w-[120px]"
                    aria-label="Search bots"
                  />
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <button
                    onClick={() => setStatusFilter('all')}
                    className={`px-2 sm:px-3 py-1.5 rounded-lg sm:rounded-xl text-xs sm:text-sm border ${statusFilter === 'all' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-50'}`}
                  >
                    {t('common.all', 'All')}
                  </button>
                  <button
                    onClick={() => setStatusFilter('active')}
                    className={`px-2 sm:px-3 py-1.5 rounded-lg sm:rounded-xl text-xs sm:text-sm border ${statusFilter === 'active' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-50'}`}
                  >
                    <span className="hidden sm:inline">{t('bots.active', 'Active')}</span>
                    <span className="sm:hidden">Act.</span>
                  </button>
                  <button
                    onClick={() => setStatusFilter('paused')}
                    className={`px-2 sm:px-3 py-1.5 rounded-lg sm:rounded-xl text-xs sm:text-sm border ${statusFilter === 'paused' ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-50'}`}
                  >
                    <span className="hidden sm:inline">{t('bots.paused', 'Paused')}</span>
                    <span className="sm:hidden">Pau.</span>
                  </button>
                </div>
                <button
                  className="inline-flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 text-xs sm:text-sm shadow-sm whitespace-nowrap"
                  onClick={onCreateNewBot}
                  aria-label="Create new bot"
                >
                  <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">{t('bots.new', 'New Bot')}</span>
                  <span className="sm:hidden">New</span>
                </button>
              </div>
            }
          >
            {/* Mobile search */}
            <div className="sm:hidden mb-4">
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-300 bg-white">
                <Search className="h-4 w-4 text-gray-500" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('bots.search', 'Search bots...')}
                  className="outline-none text-sm bg-transparent placeholder:text-gray-400 flex-1"
                  aria-label="Search bots"
                />
                <Filter className="h-4 w-4 text-gray-400" />
              </div>
            </div>

            {filteredBots.length === 0 ? (
              <div className="text-center py-12">
                <div className="mx-auto w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center">
                  <Bot className="h-6 w-6 text-gray-500" />
                </div>
                <p className="mt-3 text-gray-800 font-medium">
                  {t('bots.emptyTitle', 'No bots found')}
                </p>
                <p className="text-sm text-gray-500">
                  {t('bots.emptySub', 'Try changing filters or create a new bot.')}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
                {filteredBots.map((b) => (
                  <div
                    key={b.id}
                    onClick={() => {
                      console.log('%c[Dashboard.jsx] 🖱 Bot card clicked', 'color:teal; font-weight:bold;');
                      console.log('Clicked bot ID:', b.id);
                      console.log('Current activeChatbotId before click:', activeChatbotId);
                      onSelectBot(b.id);
                    }}
                    className={`rounded-2xl border bg-white p-4 hover:shadow-sm transition-shadow cursor-pointer ${
                      activeChatbotId === b.id 
                      ? 'border-indigo-500 ring-2 ring-indigo-100' 
                      : 'border-gray-200'
                    }`}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelectBot(b.id); }}
                    aria-pressed={activeChatbotId === b.id}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`p-2 rounded-xl ${b.status === 'active' ? 'bg-emerald-50' : 'bg-amber-50'}`}>
                          <Bot className={`h-5 w-5 ${b.status === 'active' ? 'text-emerald-600' : 'text-amber-600'}`} />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-gray-900">{b.name}</div>
                          <div className="text-xs text-gray-500">
                            {t('bots.created', 'Created')} {new Date(b.createdAt).toLocaleDateString()}
                            {' • '}
                            {b.status === 'active' ? t('bots.statusActive', 'Active') : t('bots.statusPaused', 'Paused')}
                          </div>
                        </div>
                      </div>
                      <button 
                        className="p-2 rounded-lg hover:bg-gray-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="h-4 w-4 text-gray-500" />
                      </button>
                    </div>

                    <p className="text-sm text-gray-700 mt-3 line-clamp-2">{b.description}</p>

                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {b.tags.map((tg) => (
                        <span key={tg} className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700 border border-gray-200">
                          {tg}
                        </span>
                      ))}
                    </div>

                    <div className="mt-4 grid grid-cols-1">
                      <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                        <div className="text-[11px] text-gray-500">{t('bots.status', 'Status')}</div>
                        <div className={`text-sm font-semibold ${b.status === 'active' ? 'text-emerald-700' : 'text-amber-700'}`}>
                          {b.status === 'active' ? t('bots.active', 'Active') : t('bots.paused', 'Paused')}
                        </div>
                      </div>
                    </div>


                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleBotStatus(b.id); }}
                        className={`inline-flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm border transition ${
                          b.status === 'active'
                            ? 'bg-white text-gray-800 border-gray-300 hover:bg-gray-50'
                            : 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
                        }`}
                      >
                        {b.status === 'active' ? <Pause className="h-3 w-3 sm:h-4 sm:w-4" /> : <Play className="h-3 w-3 sm:h-4 sm:w-4" />}
                        {b.status === 'active' ? t('bots.pause', 'Pause') : t('bots.activate', 'Activate')}
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); onEditBot(b.id); }}  // ← Προσθήκη αυτού
                        className="inline-flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm border border-gray-300 bg-white hover:bg-gray-50"
                      >
                        <Edit3 className="h-3 w-3 sm:h-4 sm:w-4" />
                        {t('bots.edit', 'Edit')}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(b.id); }}
                        disabled={deletingId === b.id}
                        className="inline-flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                      >
                        <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                        {deletingId === b.id ? 'Deleting…' : t('bots.delete', 'Delete')}
                      </button>

                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}
