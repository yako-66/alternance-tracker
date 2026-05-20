import React, { useEffect, useState } from 'react';
import { api } from '../hooks/api';
import './Dashboard.css';

const STATUT_CONFIG = {
  'Postulé':               { color: '#4ecdc4', emoji: '📤' },
  'En attente':            { color: '#ff9f43', emoji: '⏳' },
  'En attente de réponse': { color: '#ffd93d', emoji: '💬' },
  'Entretien':             { color: '#00d4a0', emoji: '🎯' },
  'Refus':                 { color: '#ff6b6b', emoji: '❌' },
  'Sans suite':            { color: '#6b6b80', emoji: '🚫' },
};

export default function Dashboard({ navigate }) {
  const [stats, setStats] = useState(null);

  useEffect(() => { api.get('/api/stats').then(setStats); }, []);

  if (!stats) return <div className="loading"><div className="spinner" /></div>;

  const tauxReponse = stats.total > 0
    ? Math.round((stats.byStatut.filter(s => s.statut !== 'Postulé').reduce((a,b) => a + b.count, 0) / stats.total) * 100)
    : 0;

  return (
    <div className="dashboard">
      <div className="dash-header">
        <div>
          <h1 className="dash-title">Bonjour Yakup 👋</h1>
          <p className="dash-sub">Mastère Infra & Cloud Xpert — Octobre 2026</p>
        </div>
        <button className="btn-primary" onClick={() => navigate('candidatures')}>
          + Nouvelle candidature
        </button>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card kpi-main">
          <div className="kpi-num">{stats.total}</div>
          <div className="kpi-label">Candidatures totales</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-num" style={{color:'var(--green)'}}>{tauxReponse}%</div>
          <div className="kpi-label">Taux de retour</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-num" style={{color:'var(--accent)'}}>
            {stats.byStatut.find(s => s.statut === 'Entretien')?.count || 0}
          </div>
          <div className="kpi-label">Entretiens</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-num" style={{color:'var(--orange)'}}>
            {stats.byStatut.filter(s => ['En attente','En attente de réponse'].includes(s.statut)).reduce((a,b) => a + b.count, 0)}
          </div>
          <div className="kpi-label">En attente</div>
        </div>
      </div>

      <div className="dash-grid">
        <div className="card">
          <h2 className="card-title">Par statut</h2>
          <div className="statut-list">
            {Object.entries(STATUT_CONFIG).map(([statut, cfg]) => {
              const found = stats.byStatut.find(s => s.statut === statut);
              const count = found?.count || 0;
              const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
              return (
                <div className="statut-row" key={statut}>
                  <div className="statut-left">
                    <span>{cfg.emoji}</span>
                    <span className="statut-name">{statut}</span>
                  </div>
                  <div className="statut-bar-wrap">
                    <div className="statut-bar" style={{width:`${pct}%`, background: cfg.color}} />
                  </div>
                  <span className="statut-count">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card">
          <h2 className="card-title">Dernières candidatures</h2>
          <div className="recent-list">
            {stats.recent.map(c => (
              <div className="recent-row" key={c.id} onClick={() => navigate('detail', c.id)}>
                <div>
                  <div className="recent-entreprise">{c.entreprise}</div>
                  <div className="recent-poste">{c.poste}</div>
                </div>
                <span className="badge" style={{background: STATUT_CONFIG[c.statut]?.color + '22', color: STATUT_CONFIG[c.statut]?.color}}>
                  {c.statut}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
