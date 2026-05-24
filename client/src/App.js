import React, { useEffect, useRef, useState } from 'react';
import Dashboard from './pages/Dashboard';
import Candidatures from './pages/Candidatures';
import Detail from './pages/Detail';
import Stats from './pages/Stats';
import Settings from './pages/Settings';
import MapGlobale from './pages/MapGlobale';
import Calendar from './pages/Calendar';
import GlobalTimeline from './pages/GlobalTimeline';
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
  ];

  const isActive = (id) => {
    if (id === 'candidatures') return page === 'candidatures' || page === 'detail';
    return page === id;
  };

  return (
    <div className="app">
      {showSearch && <GlobalSearch navigate={navigate} onClose={() => setShowSearch(false)} />}
      {showNotes && <QuickNotes onClose={() => setShowNotes(false)} />}

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

      {/* Notes rapides FAB */}
      <button
        className={`qnotes-fab ${showNotes ? 'qnotes-fab-active' : ''}`}
        onClick={() => setShowNotes(s => !s)}
        title="Notes rapides"
      >
        📝
      </button>
    </div>
  );
}
