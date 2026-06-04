import React, { useEffect, useRef, useState } from 'react';
import Dashboard    from './pages/Dashboard';
import Candidatures from './pages/Candidatures';
import Calendar     from './pages/Calendar';
import Stats        from './pages/Stats';
import Settings     from './pages/Settings';
import MapGlobale   from './pages/MapGlobale';
import { api }      from './hooks/api';
import './App.css';

const STATUT_COLORS = {
  'Postulé':'#4ecdc4','En attente':'#ff9f43','En attente de réponse':'#ffd93d',
  'Entretien':'#00d4a0','Refus':'#ff6b6b','Sans suite':'#4a4a60'
};

function GlobalSearch({ navigate, onClose }) {
  const [val, setVal]         = useState('');
  const [results, setResults] = useState([]);
  const [all, setAll]         = useState([]);
  const [idx, setIdx]         = useState(0);
  const inputRef              = useRef(null);

  useEffect(() => {
    api.get('/api/candidatures').then(d => setAll(d || [])).catch(() => {});
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!val.trim()) { setResults([]); setIdx(0); return; }
    const q = val.toLowerCase();
    setResults(
      all.filter(c =>
        c.entreprise?.toLowerCase().includes(q) ||
        c.poste?.toLowerCase().includes(q) ||
        c.localisation?.toLowerCase().includes(q)
      ).slice(0, 8)
    );
    setIdx(0);
  }, [val, all]);

  const go = () => { navigate('candidatures'); onClose(); };

  const handleKey = (e) => {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(i => Math.min(i + 1, results.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setIdx(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && results[idx]) go();
  };

  return (
    <div className="gsearch-overlay" onClick={onClose}>
      <div className="gsearch-box" onClick={e => e.stopPropagation()}>
        <div className="gsearch-input-wrap">
          <span className="gsearch-icon">🔍</span>
          <input
            ref={inputRef} className="gsearch-input"
            placeholder="Entreprise, poste, ville…"
            value={val} onChange={e => setVal(e.target.value)} onKeyDown={handleKey}
          />
          {val && <button className="gsearch-clear" onClick={() => setVal('')}>✕</button>}
          <kbd className="gsearch-esc" onClick={onClose}>Échap</kbd>
        </div>
        {results.length > 0 && (
          <div className="gsearch-results">
            {results.map((c, i) => (
              <div
                key={c.id}
                className={`gsearch-result ${i === idx ? 'gsearch-result-active' : ''}`}
                onClick={go} onMouseEnter={() => setIdx(i)}
              >
                <div className="gsearch-avatar">{(c.entreprise?.[0] || c.poste?.[0] || '?').toUpperCase()}</div>
                <div className="gsearch-info">
                  <div className="gsearch-name">{c.poste || c.entreprise}</div>
                  <div className="gsearch-meta">{[c.entreprise, c.localisation].filter(Boolean).join(' · ')}</div>
                </div>
                <span className="gsearch-statut" style={{ background: (STATUT_COLORS[c.statut] || '#666') + '22', color: STATUT_COLORS[c.statut] || '#666' }}>
                  {c.statut}
                </span>
              </div>
            ))}
          </div>
        )}
        {val && !results.length && <div className="gsearch-empty">Aucun résultat pour « {val} »</div>}
        {!val && <div className="gsearch-hint">Tape pour chercher · <kbd>↑↓</kbd> naviguer · <kbd>Entrée</kbd> ouvrir</div>}
      </div>
    </div>
  );
}

function WakeupScreen({ elapsed }) {
  const messages = [
    { at: 0,  text: 'Connexion au serveur…' },
    { at: 5,  text: 'Le serveur se réveille, encore quelques secondes…' },
    { at: 20, text: 'Render démarre la base de données…' },
    { at: 45, text: 'Ça prend un peu plus de temps, patience…' },
  ];
  const msg = [...messages].reverse().find(m => elapsed >= m.at)?.text || messages[0].text;
  const pct = Math.min((elapsed / 60) * 100, 95);
  return (
    <div className="wakeup-screen">
      <div className="wakeup-box">
        <div className="wakeup-logo">⚡</div>
        <div className="wakeup-title">AlternanceHub</div>
        <div className="wakeup-msg">{msg}</div>
        <div className="wakeup-bar-track"><div className="wakeup-bar-fill" style={{ width: `${pct}%` }} /></div>
        <div className="wakeup-hint">{elapsed < 5 ? 'Chargement…' : `${Math.round(elapsed)}s — Render free tier`}</div>
      </div>
    </div>
  );
}

export default function App() {
  const [page, setPage]               = useState('dashboard');
  const [serverReady, setServerReady] = useState(false);
  const [serverElapsed, setServerElapsed] = useState(0);
  const [darkMode, setDarkMode]       = useState(() => localStorage.getItem('theme') === 'dark');
  const [showSearch, setShowSearch]   = useState(false);

  useEffect(() => {
    const t0 = Date.now();
    let cancelled = false, timer;
    const tick = setInterval(() => { if (!cancelled) setServerElapsed(Math.round((Date.now() - t0) / 1000)); }, 1000);
    (async () => {
      while (!cancelled) {
        try {
          const ctrl = new AbortController();
          const tid  = setTimeout(() => ctrl.abort(), 5000);
          await fetch('/api/ping', { signal: ctrl.signal });
          clearTimeout(tid);
          if (!cancelled) setServerReady(true);
          break;
        } catch { await new Promise(r => { timer = setTimeout(r, 3000); }); }
      }
    })();
    return () => { cancelled = true; clearInterval(tick); clearTimeout(timer); };
  }, []);

  useEffect(() => {
    if (!serverReady) return;
    const id = setInterval(() => fetch('/api/ping').catch(() => {}), 14 * 60 * 1000);
    return () => clearInterval(id);
  }, [serverReady]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    const c = localStorage.getItem('accent_color');
    if (c) document.documentElement.style.setProperty('--purple', c);
  }, []);

  useEffect(() => {
    const h = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); setShowSearch(s => !s); }
      if (e.key === 'Escape') setShowSearch(false);
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, []);

  const navigate   = (p) => { setPage(p); window.scrollTo(0, 0); };
  const toggleDark = () => setDarkMode(d => { localStorage.setItem('theme_manual', '1'); return !d; });

  const NAV = [
    { id: 'dashboard',    label: 'Dashboard',    icon: '📊' },
    { id: 'candidatures', label: 'Candidatures', icon: '📝' },
    { id: 'calendar',     label: 'Calendrier',   icon: '📅' },
    { id: 'carte',        label: 'Carte',        icon: '🗺️' },
    { id: 'stats',        label: 'Stats',        icon: '📈' },
  ];

  if (!serverReady && serverElapsed >= 3) return <WakeupScreen elapsed={serverElapsed} />;

  return (
    <div className="app">
      {showSearch && <GlobalSearch navigate={navigate} onClose={() => setShowSearch(false)} />}

      <nav className="navbar">
        <div className="nav-brand" onClick={() => navigate('dashboard')}>
          <div className="nav-logo-wrap">⚡</div>
          <span className="nav-title">AlternanceHub</span>
        </div>
        <div className="nav-links">
          {NAV.map(n => (
            <button key={n.id} className={`nav-btn ${page === n.id ? 'active' : ''}`} onClick={() => navigate(n.id)}>
              {n.label}
            </button>
          ))}
        </div>
        <div className="nav-right">
          <button className="search-trigger" onClick={() => setShowSearch(true)} title="Ctrl+K">
            🔍 <span className="search-trigger-hint">Ctrl+K</span>
          </button>
          <button className="theme-toggle" onClick={toggleDark}>{darkMode ? '☀️' : '🌙'}</button>
          <button className="settings-btn" onClick={() => navigate('settings')}>⚙️</button>
        </div>
      </nav>

      <main className="main">
        {page === 'dashboard'    && <Dashboard    navigate={navigate} />}
        {page === 'candidatures' && <Candidatures navigate={navigate} />}
        {page === 'calendar'     && <Calendar     navigate={navigate} />}
        {page === 'carte'        && <MapGlobale   navigate={navigate} />}
        {page === 'stats'        && <Stats />}
        {page === 'settings'     && <Settings />}
      </main>

      <nav className="bottom-nav">
        {NAV.map(n => (
          <button key={n.id} className={`bottom-nav-btn ${page === n.id ? 'active' : ''}`} onClick={() => navigate(n.id)}>
            <span>{n.icon}</span><span>{n.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
