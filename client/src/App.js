import React, { useState } from 'react';
import Dashboard from './pages/Dashboard';
import Candidatures from './pages/Candidatures';
import Detail from './pages/Detail';
import Stats from './pages/Stats';
import './App.css';

export default function App() {
  const [page, setPage] = useState('dashboard');
  const [selectedId, setSelectedId] = useState(null);

  const navigate = (p, id = null) => { setPage(p); setSelectedId(id); window.scrollTo(0,0); };

  return (
    <div className="app">
      <nav className="navbar">
        <div className="nav-brand" onClick={() => navigate('dashboard')}>
          <div className="nav-logo-wrap">⚡</div>
          <span className="nav-title">AlternanceTracker</span>
        </div>
        <div className="nav-links">
          <button className={page === 'dashboard' ? 'nav-btn active' : 'nav-btn'} onClick={() => navigate('dashboard')}>Dashboard</button>
          <button className={page === 'candidatures' || page === 'detail' ? 'nav-btn active' : 'nav-btn'} onClick={() => navigate('candidatures')}>Candidatures</button>
          <button className={page === 'stats' ? 'nav-btn active' : 'nav-btn'} onClick={() => navigate('stats')}>Statistiques</button>
        </div>
      </nav>

      <main className="main">
        {page === 'dashboard' && <Dashboard navigate={navigate} />}
        {page === 'candidatures' && <Candidatures navigate={navigate} />}
        {page === 'detail' && <Detail id={selectedId} navigate={navigate} />}
        {page === 'stats' && <Stats navigate={navigate} />}
      </main>

      <nav className="bottom-nav">
        <button className={page === 'dashboard' ? 'bottom-nav-btn active' : 'bottom-nav-btn'} onClick={() => navigate('dashboard')}>
          <span>📊</span><span>Dashboard</span>
        </button>
        <button className={page === 'candidatures' || page === 'detail' ? 'bottom-nav-btn active' : 'bottom-nav-btn'} onClick={() => navigate('candidatures')}>
          <span>📋</span><span>Candidatures</span>
        </button>
        <button className={page === 'stats' ? 'bottom-nav-btn active' : 'bottom-nav-btn'} onClick={() => navigate('stats')}>
          <span>📈</span><span>Stats</span>
        </button>
      </nav>
    </div>
  );
}
