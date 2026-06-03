import React, { useEffect, useRef, useState } from 'react';
import { api } from '../hooks/api';
import { SOURCE_COLORS, SOURCE_LABELS } from '../App';
import './Stats.css';

function useCountUp(target, dur = 800) {
  const [v, setV] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    if (target === prev.current) return;
    const t0 = Date.now(), from = prev.current, delta = target - from;
    if (!delta) return;
    const f = () => {
      const p = Math.min((Date.now() - t0) / dur, 1);
      setV(Math.round(from + (1 - Math.pow(1 - p, 3)) * delta));
      if (p < 1) requestAnimationFrame(f); else { setV(target); prev.current = target; }
    };
    requestAnimationFrame(f);
  }, [target, dur]);
  return v;
}

function HorizBar({ label, count, max, color }) {
  return (
    <div className="hbar-row">
      <span className="hbar-label">{label}</span>
      <div className="hbar-track">
        <div className="hbar-fill" style={{ width: `${max ? Math.round((count / max) * 100) : 0}%`, background: color }} />
      </div>
      <span className="hbar-val">{count}</span>
    </div>
  );
}

function HistoryChart({ history }) {
  if (!history?.length) return null;
  const sorted = [...history].reverse().slice(-14);
  const max = Math.max(...sorted.map(h => Number(h.count)), 1);
  return (
    <div className="hist-chart">
      {sorted.map(h => {
        const pct = Math.round((Number(h.count) / max) * 100);
        return (
          <div key={h.day} className="hist-col" title={`${h.day} : ${h.count} offres`}>
            <div className="hist-bar" style={{ height: `${Math.max(pct, 4)}%` }} />
            <div className="hist-label">{h.day.slice(5)}</div>
          </div>
        );
      })}
    </div>
  );
}

export default function Stats() {
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/offres/stats').then(s => { setStats(s); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const total     = useCountUp(stats?.total    || 0);
  const favoris   = useCountUp(stats?.favoris  || 0);
  const nouvelles = useCountUp(stats?.nouvelles || 0);

  const maxSrc = stats?.bySrc ? Math.max(...stats.bySrc.map(s => Number(s.count)), 1) : 1;
  const maxLoc = stats?.byLoc ? Math.max(...stats.byLoc.map(l => Number(l.count)), 1) : 1;
  const maxSec = stats?.bySec ? Math.max(...stats.bySec.map(s => Number(s.count)), 1) : 1;

  if (loading) return (
    <div className="stats-page">
      <div className="loading"><div className="spinner" /></div>
    </div>
  );

  return (
    <div className="stats-page">
      {/* KPIs */}
      <div className="stats-kpi-row">
        <div className="stats-kpi"><span className="stats-kpi-val">{total}</span><span className="stats-kpi-lbl">Offres total</span></div>
        <div className="stats-kpi"><span className="stats-kpi-val" style={{ color: '#7c3aed' }}>{nouvelles}</span><span className="stats-kpi-lbl">Non lues</span></div>
        <div className="stats-kpi"><span className="stats-kpi-val" style={{ color: '#e11d48' }}>{favoris}</span><span className="stats-kpi-lbl">Favoris</span></div>
        <div className="stats-kpi"><span className="stats-kpi-val" style={{ color: '#16a34a' }}>{stats?.bySrc?.length || 0}</span><span className="stats-kpi-lbl">Sources</span></div>
      </div>

      {/* Historique */}
      {stats?.history?.length > 0 && (
        <div className="stats-card">
          <div className="stats-section-title">Offres ajoutées (14 derniers jours)</div>
          <HistoryChart history={stats.history} />
        </div>
      )}

      <div className="stats-cols">
        {/* Par source */}
        {stats?.bySrc?.length > 0 && (
          <div className="stats-card">
            <div className="stats-section-title">Par source</div>
            {stats.bySrc.map(s => (
              <HorizBar
                key={s.source}
                label={SOURCE_LABELS[s.source] || s.source}
                count={Number(s.count)}
                max={maxSrc}
                color={SOURCE_COLORS[s.source] || '#666'}
              />
            ))}
          </div>
        )}

        {/* Par ville */}
        {stats?.byLoc?.length > 0 && (
          <div className="stats-card">
            <div className="stats-section-title">Top villes</div>
            {stats.byLoc.map(l => (
              <HorizBar
                key={l.localisation}
                label={l.localisation || 'Non renseignée'}
                count={Number(l.count)}
                max={maxLoc}
                color="#7c3aed"
              />
            ))}
          </div>
        )}

        {/* Par secteur */}
        {stats?.bySec?.length > 0 && (
          <div className="stats-card">
            <div className="stats-section-title">Top secteurs</div>
            {stats.bySec.map(s => (
              <HorizBar
                key={s.secteur}
                label={s.secteur || 'Non renseigné'}
                count={Number(s.count)}
                max={maxSec}
                color="#2563eb"
              />
            ))}
          </div>
        )}
      </div>

      {/* Dernière MAJ */}
      {stats?.lastScrapeAt && (
        <div className="stats-footer">
          Dernier scraping :{' '}
          <strong>{new Date(stats.lastScrapeAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</strong>
        </div>
      )}

      {!stats?.total && (
        <div className="stats-empty">Aucune donnée disponible. Lancer le scraping depuis la page Offres.</div>
      )}
    </div>
  );
}
