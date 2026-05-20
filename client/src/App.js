import React, { useState } from 'react';
import Dashboard from './pages/Dashboard';
import Candidatures from './pages/Candidatures';
import Detail from './pages/Detail';
import './App.css';

export default function App() {
  const [page, setPage] = useState('dashboard');
  const [selectedId, setSelectedId] = useState(null);

  const navigate = (p, id = null) => { setPage(p); setSelectedId(id); };

  return (
    <div className="app">
      <nav className="navbar">
        <div className="nav-brand" onClick={() => navigate('dashboard')}>
          <span className="nav-logo">⚡</span>
          <span className="nav-title">AlternanceTracker</span>
        </div>
        <div className="nav-links">
          <button className={page === 'dashboard' ? 'nav-btn active' : 'nav-btn'} onClick={() => navigate('dashboard')}>Dashboard</button>
          <button className={page === 'candidatures' ? 'nav-btn active' : 'nav-btn'} onClick={() => navigate('candidatures')}>Candidatures</button>
        </div>
      </nav>
      <main className="main">
        {page === 'dashboard' && <Dashboard navigate={navigate} />}
        {page === 'candidatures' && <Candidatures navigate={navigate} />}
        {page === 'detail' && <Detail id={selectedId} navigate={navigate} />}
      </main>
    </div>
  );
}
