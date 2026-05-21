import React, { useEffect, useState } from 'react';
import { api } from '../hooks/api';
import './Stats.css';

const STATUT_COLORS = {
  'Postulé':'#4ecdc4','En attente':'#ff9f43','En attente de réponse':'#ffd93d',
  'Entretien':'#00d4a0','Refus':'#ff6b6b','Sans suite':'#4a4a60'
};

export default function Stats() {
  const [list, setList] = useState([]);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get('/api/candidatures').then(setList);
    api.get('/api/stats').then(setStats);
  }, []);

  if (!stats || !list.length) return <div className="loading"><div className="spinner" /></div>;

  // Stats par source
  const bySource = list.reduce((acc, c) => {
    const s = c.source || 'Non renseigné';
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});
  const sourcesSorted = Object.entries(bySource).sort((a,b) => b[1]-a[1]).slice(0,6);

  // Stats par localisation
  const byLoc = list.reduce((acc, c) => {
    const l = c.localisation || 'Non renseigné';
    acc[l] = (acc[l] || 0) + 1;
    return acc;
  }, {});
  const locSorted = Object.entries(byLoc).sort((a,b) => b[1]-a[1]).slice(0,6);

  // Taux conversion
  const entretiens = stats.byStatut.find(s => s.statut === 'Entretien')?.count || 0;
  const refus = stats.byStatut.find(s => s.statut === 'Refus')?.count || 0;
  const tauxEntretien = stats.total > 0 ? ((entretiens / stats.total) * 100).toFixed(1) : 0;
  const tauxRefus = stats.total > 0 ? ((refus / stats.total) * 100).toFixed(1) : 0;
  const tauxReponse = stats.total > 0
    ? (((stats.total - (stats.byStatut.find(s => s.statut === 'Postulé')?.count || 0)) / stats.total) * 100).toFixed(1)
    : 0;

  const maxSource = Math.max(...sourcesSorted.map(s => s[1]));
  const maxLoc = Math.max(...locSorted.map(l => l[1]));

  return (
    <div className="stats-page">
      <h1 className="page-title">Statistiques 📈</h1>

      <div className="stats-kpi">
        <div className="stats-kpi-card">
          <div className="stats-kpi-num" style={{color:'var(--accent)'}}>{tauxReponse}%</div>
          <div className="stats-kpi-label">Taux de réponse</div>
          <div className="stats-kpi-sub">des entreprises ont répondu</div>
        </div>
        <div className="stats-kpi-card">
          <div className="stats-kpi-num" style={{color:'var(--green)'}}>{tauxEntretien}%</div>
          <div className="stats-kpi-label">Taux d'entretien</div>
          <div className="stats-kpi-sub">ont abouti en entretien</div>
        </div>
        <div className="stats-kpi-card">
          <div className="stats-kpi-num" style={{color:'var(--red)'}}>{tauxRefus}%</div>
          <div className="stats-kpi-label">Taux de refus</div>
          <div className="stats-kpi-sub">ont reçu un refus</div>
        </div>
        <div className="stats-kpi-card">
          <div className="stats-kpi-num" style={{color:'var(--yellow)'}}>{stats.total}</div>
          <div className="stats-kpi-label">Total candidatures</div>
          <div className="stats-kpi-sub">depuis le début</div>
        </div>
      </div>

      <div className="stats-grid">
        <div className="card">
          <h2 className="card-title">Répartition par statut</h2>
          <div className="donut-wrap">
            <svg viewBox="0 0 120 120" className="donut-svg">
              {(() => {
                let offset = 0;
                const r = 45; const circ = 2 * Math.PI * r;
                return stats.byStatut.filter(s => s.count > 0).map((s, i) => {
                  const pct = s.count / stats.total;
                  const dash = pct * circ;
                  const el = (
                    <circle key={s.statut} cx="60" cy="60" r={r}
                      fill="none" strokeWidth="18"
                      stroke={STATUT_COLORS[s.statut] || '#4a4a60'}
                      strokeDasharray={`${dash} ${circ - dash}`}
                      strokeDashoffset={-offset * circ / 360 * 360 + circ * 0.25}
                      style={{transition:'all 0.5s'}}
                    />
                  );
                  offset += pct * 360;
                  return el;
                });
              })()}
              <text x="60" y="56" textAnchor="middle" fill="white" fontSize="18" fontWeight="800" fontFamily="Syne">{stats.total}</text>
              <text x="60" y="70" textAnchor="middle" fill="#6b6b90" fontSize="8">candidatures</text>
            </svg>
            <div className="donut-legend">
              {stats.byStatut.filter(s => s.count > 0).map(s => (
                <div className="legend-item" key={s.statut}>
                  <div className="legend-dot" style={{background: STATUT_COLORS[s.statut] || '#4a4a60'}} />
                  <span className="legend-label">{s.statut}</span>
                  <span className="legend-count">{s.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="card-title">Meilleures sources</h2>
          <div className="bar-chart">
            {sourcesSorted.map(([source, count]) => (
              <div className="bar-row" key={source}>
                <div className="bar-label">{source}</div>
                <div className="bar-wrap">
                  <div className="bar-fill" style={{width:`${(count/maxSource)*100}%`, background:'linear-gradient(90deg, var(--accent), var(--accent2))'}} />
                </div>
                <div className="bar-count">{count}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h2 className="card-title">Par localisation</h2>
          <div className="bar-chart">
            {locSorted.map(([loc, count]) => (
              <div className="bar-row" key={loc}>
                <div className="bar-label">{loc}</div>
                <div className="bar-wrap">
                  <div className="bar-fill" style={{width:`${(count/maxLoc)*100}%`, background:'linear-gradient(90deg, var(--green), var(--blue))'}} />
                </div>
                <div className="bar-count">{count}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h2 className="card-title">Entonnoir de conversion</h2>
          <div className="funnel">
            {[
              { label:'Candidatures envoyées', count:stats.total, color:'var(--accent)', pct:100 },
              { label:'Réponses reçues', count: stats.total - (stats.byStatut.find(s=>s.statut==='Postulé')?.count||0), color:'var(--blue)', pct: parseFloat(tauxReponse) },
              { label:'Entretiens', count: entretiens, color:'var(--green)', pct: parseFloat(tauxEntretien) },
            ].map((item, i) => (
              <div className="funnel-row" key={i}>
                <div className="funnel-bar-wrap">
                  <div className="funnel-bar" style={{width:`${item.pct}%`, background:item.color}} />
                </div>
                <div className="funnel-info">
                  <span className="funnel-label">{item.label}</span>
                  <span className="funnel-count" style={{color:item.color}}>{item.count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
