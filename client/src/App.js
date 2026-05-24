import React, { useEffect, useState } from 'react';
import Dashboard from './pages/Dashboard';
import Candidatures from './pages/Candidatures';
import Detail from './pages/Detail';
import Stats from './pages/Stats';
import Settings from './pages/Settings';
import MapGlobale from './pages/MapGlobale';
import Calendar from './pages/Calendar';
import GlobalTimeline from './pages/GlobalTimeline';
import './App.css';

export default function App() {
  const [page, setPage] = useState('dashboard');
  const [selectedId, setSelectedId] = useState(null);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const navigate = (p, id = null) => { setPage(p); setSelectedId(id); window.scrollTo(0, 0); };

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
          <button className="theme-toggle" onClick={() => setDarkMode(d => !d)} title={darkMode ? 'Mode clair' : 'Mode sombre'}>
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
        <button className="bottom-nav-btn" onClick={() => navigate('settings')}>
          <span>⚙️</span><span>Paramètres</span>
        </button>
        <button className="bottom-nav-btn" onClick={() => setDarkMode(d => !d)}>
          <span>{darkMode ? '☀️' : '🌙'}</span><span>Thème</span>
        </button>
      </nav>
    </div>
  );
}
