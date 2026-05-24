import React, { useEffect, useRef, useState, useCallback } from 'react';
import Dashboard from './pages/Dashboard';
import Candidatures from './pages/Candidatures';
import Detail from './pages/Detail';
import Stats from './pages/Stats';
import Settings from './pages/Settings';
import MapGlobale from './pages/MapGlobale';
import Calendar from './pages/Calendar';
import GlobalTimeline from './pages/GlobalTimeline';
import Comparateur from './pages/Comparateur';
import PrepEntretien from './pages/PrepEntretien';
import Wrapped from './pages/Wrapped';
import { api } from './hooks/api';
import './App.css';

const STATUT_COLORS = {
  'Postulé':'#4ecdc4','En attente':'#ff9f43','En attente de réponse':'#ffd93d',
  'Entretien':'#00d4a0','Refus':'#ff6b6b','Sans suite':'#4a4a60'
};

function GlobalSearch({ navigate, onClose }) {
  const [val, setVal] = useState('');
  const [results, setResults] = useState([]);
  const [allCands, setAllCands] = useState([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    api.get('/api/candidatures').then(setAllCands);
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!val.trim()) { setResults([]); setActiveIdx(0); return; }
    const q = val.toLowerCase();
    const found = allCands.filter(c =>
      c.entreprise?.toLowerCase().includes(q) ||
      c.poste?.toLowerCase().includes(q) ||
      c.localisation?.toLowerCase().includes(q) ||
      c.notes?.toLowerCase().includes(q) ||
      c.contact?.toLowerCase().includes(q) ||
      c.source?.toLowerCase().includes(q) ||
      c.tags?.toLowerCase().includes(q)
    ).slice(0, 8);
    setResults(found);
    setActiveIdx(0);
  }, [val, allCands]);

  const go = (c) => { navigate('detail', c.id); onClose(); };

  const handleKey = (e) => {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, results.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && results[activeIdx]) go(results[activeIdx]);
  };

  return (
    <div className="gsearch-overlay" onClick={onClose}>
      <div className="gsearch-box" onClick={e => e.stopPropagation()}>
        <div className="gsearch-input-wrap">
          <span className="gsearch-icon">🔍</span>
          <input
            ref={inputRef}
            className="gsearch-input"
            placeholder="Rechercher entreprise, poste, ville, tag…"
            value={val}
            onChange={e => setVal(e.target.value)}
            onKeyDown={handleKey}
          />
          {val && <button className="gsearch-clear" onClick={() => setVal('')}>✕</button>}
          <kbd className="gsearch-esc" onClick={onClose}>Échap</kbd>
        </div>

        {results.length > 0 && (
          <div className="gsearch-results">
            {results.map((c, i) => (
              <div
                key={c.id}
                className={`gsearch-result ${i === activeIdx ? 'gsearch-result-active' : ''}`}
                onClick={() => go(c)}
                onMouseEnter={() => setActiveIdx(i)}
              >
                <div className="gsearch-avatar">{c.entreprise?.[0]}</div>
                <div className="gsearch-info">
                  <div className="gsearch-name">{c.entreprise}</div>
                  <div className="gsearch-meta">{[c.poste, c.localisation].filter(Boolean).join(' · ')}</div>
                </div>
                <span className="gsearch-statut" style={{background:STATUT_COLORS[c.statut]+'22',color:STATUT_COLORS[c.statut]}}>
                  {c.statut}
                </span>
              </div>
            ))}
          </div>
        )}
        {val && results.length === 0 && <div className="gsearch-empty">Aucun résultat pour « {val} »</div>}
        {!val && (
          <div className="gsearch-hint">
            Tape pour rechercher · <kbd>↑↓</kbd> naviguer · <kbd>Entrée</kbd> ouvrir
          </div>
        )}
      </div>
    </div>
  );
}

function Pomodoro({ onClose }) {
  const MODES = { work: 25 * 60, short: 5 * 60, long: 15 * 60 };
  const LABELS = { work: '🍅 Focus', short: '☕ Pause', long: '🛋️ Grande pause' };
  const [mode, setMode] = useState('work');
  const [seconds, setSeconds] = useState(MODES.work);
  const [running, setRunning] = useState(false);
  const [cycles, setCycles] = useState(0);
  const intervalRef = useRef(null);

  const reset = useCallback((m = mode) => {
    clearInterval(intervalRef.current);
    setRunning(false);
    setSeconds(MODES[m]);
  }, [mode]);

  const changeMode = (m) => { setMode(m); reset(m); setSeconds(MODES[m]); };

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setSeconds(s => {
          if (s <= 1) {
            clearInterval(intervalRef.current);
            setRunning(false);
            if (mode === 'work') { setCycles(c => c + 1); try { new Notification('🍅 Pomodoro terminé !', { body: 'Temps de faire une pause.', icon:'/favicon.ico' }); } catch {} }
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    }
    return () => clearInterval(intervalRef.current);
  }, [running, mode]);

  const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
  const secs = String(seconds % 60).padStart(2, '0');
  const total = MODES[mode];
  const pct = ((total - seconds) / total) * 100;
  const r = 44, circ = 2 * Math.PI * r;

  return (
    <div className="pomodoro-panel">
      <div className="pomodoro-header">
        <span className="pomodoro-title">⏱️ Pomodoro</span>
        <span className="pomodoro-cycles">{cycles} 🍅</span>
        <button className="qnotes-close" onClick={onClose}>✕</button>
      </div>
      <div className="pomodoro-modes">
        {Object.keys(MODES).map(m => (
          <button key={m} className={`pomodoro-mode-btn ${mode === m ? 'active' : ''}`} onClick={() => changeMode(m)}>{LABELS[m]}</button>
        ))}
      </div>
      <div className="pomodoro-ring-wrap">
        <svg viewBox="0 0 100 100" className="pomodoro-ring">
          <circle cx="50" cy="50" r={r} fill="none" stroke="var(--bg2)" strokeWidth="7" />
          <circle cx="50" cy="50" r={r} fill="none" stroke="var(--purple)" strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={`${(pct/100)*circ} ${circ}`}
            transform="rotate(-90 50 50)"
            style={{transition:'stroke-dasharray 0.9s ease'}}
          />
        </svg>
        <div className="pomodoro-time">{mins}:{secs}</div>
      </div>
      <div className="pomodoro-controls">
        <button className="pomodoro-btn" onClick={() => setRunning(r => !r)}>
          {running ? '⏸ Pause' : '▶ Démarrer'}
        </button>
        <button className="pomodoro-btn pomodoro-btn-reset" onClick={() => reset()}>↺ Reset</button>
      </div>
    </div>
  );
}

function QuickNotes({ onClose }) {
  const [notes, setNotes] = useState(() => localStorage.getItem('quick_notes') || '');
  const [saved, setSaved] = useState(false);
  const taRef = useRef(null);

  useEffect(() => { taRef.current?.focus(); }, []);

  const save = () => {
    localStorage.setItem('quick_notes', notes);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const handleKey = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); save(); }
    if (e.key === 'Escape') onClose();
  };

  return (
    <div className="qnotes-overlay" onClick={onClose}>
      <div className="qnotes-panel" onClick={e => e.stopPropagation()}>
        <div className="qnotes-header">
          <span className="qnotes-title">📝 Notes rapides</span>
          <span className="qnotes-hint">Ctrl+S pour sauvegarder</span>
          <button className="qnotes-close" onClick={onClose}>✕</button>
        </div>
        <textarea
          ref={taRef}
          className="qnotes-textarea"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Tes notes, idées, rappels… Tout ici."
        />
        <div className="qnotes-footer">
          <span className="qnotes-status">{saved ? '✅ Sauvegardé !' : `${notes.length} caractères`}</span>
          <button className="qnotes-save" onClick={save}>💾 Sauvegarder</button>
        </div>
      </div>
    </div>
  );
}

function CoachIA({ onClose, candidatures }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: '👋 Bonjour ! Je suis ton coach alternance. Pose-moi une question sur ta stratégie, tes candidatures, ou demande-moi de l\'analyser !' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = async () => {
    const txt = input.trim();
    if (!txt || loading) return;
    const userMsg = { role: 'user', content: txt };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setInput('');
    setLoading(true);
    try {
      const res = await api.post('/api/ai/coach', {
        messages: newMsgs.filter(m => m.role !== 'assistant' || newMsgs.indexOf(m) > 0),
        candidatures,
      });
      setMessages(prev => [...prev, { role: 'assistant', content: res.content }]);
    } catch(e) {
      setMessages(prev => [...prev, { role: 'assistant', content: '❌ Erreur : ' + (e.message || 'API indisponible') }]);
    }
    setLoading(false);
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    if (e.key === 'Escape') onClose();
  };

  const SUGGESTIONS = ['Analyse mes candidatures', 'Quelles entreprises relancer ?', 'Comment améliorer mon taux d\'entretien ?'];

  return (
    <div className="coach-overlay" onClick={onClose}>
      <div className="coach-panel" onClick={e => e.stopPropagation()}>
        <div className="coach-header">
          <span className="coach-title">🤖 Coach IA</span>
          <span className="coach-subtitle">{candidatures.length} candidatures analysées</span>
          <button className="qnotes-close" onClick={onClose}>✕</button>
        </div>
        <div className="coach-messages">
          {messages.map((m, i) => (
            <div key={i} className={`coach-msg coach-msg-${m.role}`}>
              <div className="coach-msg-bubble">{m.content}</div>
            </div>
          ))}
          {loading && (
            <div className="coach-msg coach-msg-assistant">
              <div className="coach-msg-bubble coach-loading">
                <span className="coach-dot" /><span className="coach-dot" /><span className="coach-dot" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
        {messages.length <= 1 && (
          <div className="coach-suggestions">
            {SUGGESTIONS.map(s => (
              <button key={s} className="coach-suggestion-btn" onClick={() => { setInput(s); inputRef.current?.focus(); }}>{s}</button>
            ))}
          </div>
        )}
        <div className="coach-input-row">
          <textarea
            ref={inputRef}
            className="coach-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Pose une question… (Entrée pour envoyer)"
            rows={2}
          />
          <button className="coach-send-btn" onClick={send} disabled={loading || !input.trim()}>
            {loading ? '⏳' : '➤'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState('dashboard');
  const [selectedId, setSelectedId] = useState(null);
  const [darkMode, setDarkMode] = useState(() => {
    const stored = localStorage.getItem('theme');
    if (stored) return stored === 'dark';
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  });
  const [showSearch, setShowSearch] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [showPomodoro, setShowPomodoro] = useState(false);
  const [showCoach, setShowCoach] = useState(false);
  const [candidatures, setCandidatures] = useState([]);

  // Sync theme to DOM + localStorage
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  // Follow OS dark mode preference (only if user hasn't set one)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e) => {
      if (!localStorage.getItem('theme_manual')) setDarkMode(e.matches);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Apply saved accent color
  useEffect(() => {
    const color = localStorage.getItem('accent_color');
    if (color) document.documentElement.style.setProperty('--purple', color);
  }, []);

  // Check rappels + auto-archive on startup
  useEffect(() => {
    api.get('/api/candidatures').then(all => {
      setCandidatures(all);
      // Rappels personnalisés
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        const today = new Date(); today.setHours(0,0,0,0);
        const todayStr = today.toISOString().split('T')[0];
        all.forEach(c => {
          if (!c.date_rappel || c.archived) return;
          const rappelKey = `rappel_notif_${c.id}_${c.date_rappel}`;
          if (localStorage.getItem(rappelKey)) return;
          const parts = c.date_rappel.includes('/') ? c.date_rappel.split('/').reverse() : c.date_rappel.split('-');
          const rd = new Date(parts.join('-')); rd.setHours(0,0,0,0);
          if (rd.getTime() === today.getTime()) {
            try {
              new Notification(`🔔 Rappel — ${c.entreprise}`, { body: `N'oublie pas de relancer ${c.entreprise} (${c.poste || 'candidature'})`, icon:'/favicon.ico' });
              localStorage.setItem(rappelKey, todayStr);
            } catch {}
          }
        });
      }
      // Auto-archivage au démarrage
      if (localStorage.getItem('auto_archive') === '1') {
        const days = parseInt(localStorage.getItem('auto_archive_days') || '30');
        const threshold = new Date(); threshold.setDate(threshold.getDate() - days);
        const toArchive = all.filter(c => {
          if (c.archived || !['Postulé','En attente'].includes(c.statut) || !c.date_candidature) return false;
          const parts = c.date_candidature.includes('/') ? c.date_candidature.split('/').reverse() : c.date_candidature.split('-');
          const d = new Date(parts.join('-'));
          return !isNaN(d) && d < threshold;
        });
        toArchive.forEach(c => api.put(`/api/candidatures/${c.id}`, {...c, archived: 1}));
      }
    }).catch(() => {});
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); setShowSearch(s => !s); }
      if (e.key === 'Escape') { setShowSearch(false); setShowNotes(false); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const navigate = (p, id = null) => { setPage(p); setSelectedId(id); window.scrollTo(0, 0); };

  const toggleDark = () => {
    setDarkMode(d => { localStorage.setItem('theme_manual', '1'); return !d; });
  };

  const NAV = [
    { id:'dashboard',    label:'Dashboard',    icon:'📊' },
    { id:'candidatures', label:'Candidatures', icon:'📋' },
    { id:'carte',        label:'Carte',        icon:'🗺️' },
    { id:'calendrier',   label:'Calendrier',   icon:'📅' },
    { id:'stats',        label:'Stats',        icon:'📈' },
    { id:'timeline',     label:'Timeline',     icon:'🕐' },
    { id:'comparateur',  label:'Comparer',     icon:'⚖️' },
    { id:'prep',         label:'Entretien',    icon:'🎤' },
    { id:'wrapped',      label:'Wrapped',      icon:'🎁' },
  ];

  const isActive = (id) => {
    if (id === 'candidatures') return page === 'candidatures' || page === 'detail';
    return page === id;
  };

  return (
    <div className="app">
      {showSearch && <GlobalSearch navigate={navigate} onClose={() => setShowSearch(false)} />}
      {showNotes && <QuickNotes onClose={() => setShowNotes(false)} />}
      {showPomodoro && <Pomodoro onClose={() => setShowPomodoro(false)} />}
      {showCoach && <CoachIA onClose={() => setShowCoach(false)} candidatures={candidatures} />}

      <nav className="navbar">
        <div className="nav-brand" onClick={() => navigate('dashboard')}>
          <div className="nav-logo-wrap">⚡</div>
          <span className="nav-title">AlternanceTracker</span>
        </div>
        <div className="nav-links">
          {NAV.map(n => (
            <button
              key={n.id}
              className={`nav-btn ${isActive(n.id) ? 'active' : ''}`}
              onClick={() => navigate(n.id)}
            >{n.label}</button>
          ))}
        </div>
        <div className="nav-right">
          <button className="search-trigger" onClick={() => setShowSearch(true)} title="Recherche globale (Ctrl+K)">
            🔍 <span className="search-trigger-hint">Ctrl+K</span>
          </button>
          <button className="theme-toggle" onClick={toggleDark} title={darkMode ? 'Mode clair' : 'Mode sombre'}>
            {darkMode ? '☀️' : '🌙'}
          </button>
          <button className="settings-btn" onClick={() => navigate('settings')} title="Paramètres">
            ⚙️
          </button>
        </div>
      </nav>

      <main className="main">
        {page === 'dashboard'    && <Dashboard navigate={navigate} />}
        {page === 'candidatures' && <Candidatures navigate={navigate} />}
        {page === 'detail'       && <Detail id={selectedId} navigate={navigate} />}
        {page === 'stats'        && <Stats navigate={navigate} />}
        {page === 'settings'     && <Settings />}
        {page === 'carte'        && <MapGlobale navigate={navigate} />}
        {page === 'calendrier'   && <Calendar navigate={navigate} />}
        {page === 'timeline'     && <GlobalTimeline navigate={navigate} />}
        {page === 'comparateur'  && <Comparateur navigate={navigate} />}
        {page === 'prep'         && <PrepEntretien navigate={navigate} />}
        {page === 'wrapped'      && <Wrapped navigate={navigate} />}
      </main>

      <nav className="bottom-nav">
        {NAV.map(n => (
          <button
            key={n.id}
            className={`bottom-nav-btn ${isActive(n.id) ? 'active' : ''}`}
            onClick={() => navigate(n.id)}
          >
            <span>{n.icon}</span>
            <span>{n.label}</span>
          </button>
        ))}
        <button className="bottom-nav-btn" onClick={() => setShowSearch(true)}>
          <span>🔍</span><span>Chercher</span>
        </button>
        <button className="bottom-nav-btn" onClick={() => navigate('settings')}>
          <span>⚙️</span><span>Paramètres</span>
        </button>
      </nav>

      {/* FABs */}
      <div className="fab-group">
        <button className={`qnotes-fab fab-pomodoro ${showPomodoro ? 'qnotes-fab-active' : ''}`} onClick={() => { setShowPomodoro(s => !s); setShowNotes(false); setShowCoach(false); }} title="Pomodoro">⏱️</button>
        <button className={`qnotes-fab ${showNotes ? 'qnotes-fab-active' : ''}`} onClick={() => { setShowNotes(s => !s); setShowPomodoro(false); setShowCoach(false); }} title="Notes rapides">📝</button>
        <button className={`qnotes-fab fab-coach ${showCoach ? 'qnotes-fab-active' : ''}`} onClick={() => { setShowCoach(s => !s); setShowNotes(false); setShowPomodoro(false); }} title="Coach IA">🤖</button>
      </div>
    </div>
  );
}
