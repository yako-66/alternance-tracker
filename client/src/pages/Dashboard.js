import React, { useEffect, useState } from 'react';
import { api } from '../hooks/api';
import './Dashboard.css';

const STATUT_CONFIG = {
  'Postulé':               { color: '#4ecdc4', emoji: '📤' },
  'En attente':            { color: '#ff9f43', emoji: '⏳' },
  'En attente de réponse': { color: '#ffd93d', emoji: '💬' },
  'Entretien':             { color: '#00d4a0', emoji: '🎯' },
  'Refus':                 { color: '#ff6b6b', emoji: '❌' },
  'Sans suite':            { color: '#4a4a60', emoji: '🚫' },
};

function daysSince(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.includes('/') ? dateStr.split('/').reverse() : dateStr.split('-');
  const d = new Date(parts.join('-'));
  if (isNaN(d)) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

export default function Dashboard({ navigate }) {
  const [stats, setStats] = useState(null);
  const [relances, setRelances] = useState([]);

  useEffect(() => {
    api.get('/api/stats').then(setStats);
    api.get('/api/candidatures').then(all => {
      const toRelance = all.filter(c => {
        if (!['Postulé','En attente'].includes(c.statut)) return false;
        const days = daysSince(c.date_candidature);
        return days !== null && days >= 7;
      }).sort((a,b) => daysSince(b.date_candidature) - daysSince(a.date_candidature)).slice(0,5);
      setRelances(toRelance);
    });
  }, []);

  if (!stats) return <div className="loading"><div className="spinner" /></div>;

  const tauxReponse = stats.total > 0
    ? Math.round((stats.byStatut.filter(s => s.statut !== 'Postulé').reduce((a,b) => a + b.count, 0) / stats.total) * 100)
    : 0;

  const entretiens = stats.byStatut.find(s => s.statut === 'Entretien')?.count || 0;
  const enAttente = stats.byStatut.filter(s => ['En attente','En attente de réponse'].includes(s.statut)).reduce((a,b) => a + b.count, 0);

  return (
    <div className="dashboard">
      <div className="dash-header">
        <div>
          <h1 className="dash-title">Bonjour Yakup 👋</h1>
          <p className="dash-sub">Mastère Infra & Cloud Xpert — Octobre 2026</p>
        </div>
        <button className="btn-primary" onClick={() => navigate('candidatures')}>+ Nouvelle candidature</button>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card kpi-main" onClick={() => navigate('candidatures')}>
          <div className="kpi-icon">📁</div>
          <div className="kpi-num">{stats.total}</div>
          <div className="kpi-label">Candidatures</div>
        </div>
        <div className="kpi-card" onClick={() => navigate('stats')}>
          <div className="kpi-icon">📈</div>
          <div className="kpi-num" style={{color:'var(--green)'}}>{tauxReponse}%</div>
          <div className="kpi-label">Taux de retour</div>
        </div>
        <div className="kpi-card" onClick={() => navigate('candidatures')}>
          <div className="kpi-icon">🎯</div>
          <div className="kpi-num" style={{color:'var(--accent)'}}>{entretiens}</div>
          <div className="kpi-label">Entretiens</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon">⏳</div>
          <div className="kpi-num" style={{color:'var(--orange)'}}>{enAttente}</div>
          <div className="kpi-label">En attente</div>
        </div>
      </div>

      {relances.length > 0 && (
        <div className="relance-banner">
          <div className="relance-title">🔴 Relances urgentes — {relances.length} candidature{relances.length > 1 ? 's' : ''} sans réponse depuis +7 jours</div>
          <div className="relance-list">
            {relances.map(c => (
              <div className="relance-item" key={c.id} onClick={() => navigate('detail', c.id)}>
                <div className="relance-avatar">{c.entreprise[0]}</div>
                <div>
                  <div className="relance-entreprise">{c.entreprise}</div>
                  <div className="relance-days">Il y a {daysSince(c.date_candidature)} jours{c.localisation ? ` · ${c.localisation}` : ''}</div>
                </div>
                <span className="relance-arrow">→</span>
              </div>
            ))}
          </div>
        </div>
      )}

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
                    <div className="statut-bar" style={{width:`${Math.max(pct,0.5)}%`, background: cfg.color}} />
                  </div>
                  <span className="statut-count" style={{color: count > 0 ? cfg.color : 'var(--muted)'}}>{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card">
          <h2 className="card-title">Dernières candidatures</h2>
          <div className="recent-list">
            {stats.recent.map(c => {
              const days = daysSince(c.date_candidature);
              const urgent = days !== null && days >= 7 && ['Postulé','En attente'].includes(c.statut);
              return (
                <div className={`recent-row ${urgent ? 'urgent' : ''}`} key={c.id} onClick={() => navigate('detail', c.id)}>
                  <div className="recent-avatar">{c.entreprise[0]}</div>
                  <div className="recent-info">
                    <div className="recent-entreprise">{c.entreprise}{urgent && <span className="urgent-dot">🔴</span>}</div>
                    <div className="recent-meta">{c.poste}{c.localisation ? ` · 📍${c.localisation}` : ''}</div>
                  </div>
                  <span className="badge" style={{background: STATUT_CONFIG[c.statut]?.color + '22', color: STATUT_CONFIG[c.statut]?.color}}>
                    {c.statut}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
