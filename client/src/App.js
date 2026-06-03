import React, { useEffect, useRef, useState } from 'react';
import Dashboard   from './pages/Dashboard';
import Offres      from './pages/Offres';
import DetailOffre from './pages/DetailOffre';
import Favoris     from './pages/Favoris';
import Stats       from './pages/Stats';
import Settings    from './pages/Settings';
import MapGlobale  from './pages/MapGlobale';
import { api }     from './hooks/api';
import './App.css';

export const SOURCE_COLORS = {
  france_travail:   '#2563eb',
  bonne_alternance: '#16a34a',
  hellowork:        '#d97706',
  manual:           '#7c3aed',
};
export const SOURCE_LABELS = {
  france_travail:   'France Travail',
  bonne_alternance: 'La Bonne Alternance',
  hellowork:        'HelloWork',
  manual:           'Manuel',
};

function GlobalSearch({ navigate, onClose }) {
  const [val, setVal]       = useState('');
  const [results, setResults] = useState([]);
  const [all, setAll]       = useState([]);
  const [idx, setIdx]       = useState(0);
  const inputRef            = useRef(null);

  useEffect(() => {
    api.get('/api/offres?limit=500').then(d => setAll(d.offres || [])).catch(() => {});
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!val.trim()) { setResults([]); setIdx(0); return; }
    const q = val.toLowerCase();
    setResults(
      all.filter(o =>
        o.titre?.toLowerCase().includes(q) ||
        o.entreprise?.toLowerCase().includes(q) ||
        o.localisation?.toLowerCase().includes(q)
      ).slice(0, 8)
    );
    setIdx(0);
  }, [val, all]);

  const go = (o) => { navigate('detail', o.id); onClose(); };

  const handleKey = (e) => {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(i => Math.min(i + 1, results.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setIdx(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && results[idx]) go(results[idx]);
  };

  return (
    <div className="gsearch-overlay" onClick={onClose}>
      <div className="gsearch-box" onClick={e => e.stopPropagation()}>
        <div className="gsearch-input-wrap">
          <span className="gsearch-icon">🔍</span>
          <input
            ref={inputRef} className="gsearch-input"
            placeholder="Titre, entreprise, ville…"
            value={val} onChange={e => setVal(e.target.value)} onKeyDown={handleKey}
          />
          {val && <button className="gsearch-clear" onClick={() => setVal('')}>✕</button>}
          <kbd className="gsearch-esc" onClick={onClose}>Échap</kbd>
        </div>
        {results.length > 0 && (
          <div className="gsearch-results">
            {results.map((o, i) => (
              <div
                key={o.id}
                className={`gsearch-result ${i === idx ? 'gsearch-result-active' : ''}`}
                onClick={() => go(o)} onMouseEnter={() => setIdx(i)}
              >
                <div className="gsearch-avatar">{(o.entreprise?.[0] || o.titre?.[0] || '?').toUpperCase()}</div>
                <div className="gsearch-info">
                  <div className="gsearch-name">{o.titre}</div>
                  <div className="gsearch-meta">{[o.entreprise, o.localisation].filter(Boolean).join(' · ')}</div>
                </div>
                <span className="gsearch-statut" style={{ background: (SOURCE_COLORS[o.source] || '#666') + '22', color: SOURCE_COLORS[o.source] || '#666' }}>
                  {SOURCE_LABELS[o.source] || o.source}
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
  const [page, setPage]           = useState('dashboard');
  const [selectedId, setSelectedId] = useState(null);
  const [serverReady, setServerReady] = useState(false);
  const [serverElapsed, setServerElapsed] = useState(0);
  const [darkMode, setDarkMode]   = useState(() => {
    const s = localStorage.getItem('theme');
    return s ? s === 'dark' : (window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false);
  });
  const [showSearch, setShowSearch] = useState(false);

  // Ping serveur
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

  const navigate   = (p, id = null) => { setPage(p); setSelectedId(id); window.scrollTo(0, 0); };
  const toggleDark = () => setDarkMode(d => { localStorage.setItem('theme_manual', '1'); return !d; });

  const NAV = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'offres',    label: 'Offres',    icon: '📋' },
    { id: 'favoris',   label: 'Favoris',   icon: '❤️' },
    { id: 'carte',     label: 'Carte',     icon: '🗺️' },
    { id: 'stats',     label: 'Stats',     icon: '📈' },
  ];

  const isActive = (id) => id === 'offres' ? (page === 'offres' || page === 'detail') : page === id;

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
            <button key={n.id} className={`nav-btn ${isActive(n.id) ? 'active' : ''}`} onClick={() => navigate(n.id)}>
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
        {page === 'dashboard' && <Dashboard navigate={navigate} />}
        {page === 'offres'    && <Offres    navigate={navigate} />}
        {page === 'detail'    && <DetailOffre id={selectedId} navigate={navigate} />}
        {page === 'favoris'   && <Favoris   navigate={navigate} />}
        {page === 'carte'     && <MapGlobale navigate={navigate} />}
        {page === 'stats'     && <Stats />}
        {page === 'settings'  && <Settings />}
      </main>

      <nav className="bottom-nav">
        {NAV.map(n => (
          <button key={n.id} className={`bottom-nav-btn ${isActive(n.id) ? 'active' : ''}`} onClick={() => navigate(n.id)}>
            <span>{n.icon}</span><span>{n.label}</span>
          </button>
        ))}
        <button className="bottom-nav-btn" onClick={() => setShowSearch(true)}>
          <span>🔍</span><span>Chercher</span>
        </button>
        <button className="bottom-nav-btn" onClick={() => navigate('settings')}>
          <span>⚙️</span><span>Réglages</span>
        </button>
      </nav>
    </div>
  );
}
