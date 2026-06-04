import React, { useEffect, useRef, useState } from 'react';
import { api } from '../hooks/api';
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
          <div key={h.day} className="hist-col" title={`${h.day} : ${h.count} candidature${Number(h.count) > 1 ? 's' : ''}`}>
            <div className="hist-bar" style={{ height: `${Math.max(pct, 4)}%` }} />
            <div className="hist-label">{h.day.slice(5)}</div>
          </div>
        );
      })}
    </div>
  );
}

const STATUT_COLORS = {
  'Postulé':'#4ecdc4','En attente':'#ff9f43','En attente de réponse':'#ffd93d',
  'Entretien':'#00d4a0','Refus':'#ff6b6b','Sans suite':'#4a4a60'
};

export default function Stats() {
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/candidatures/stats').then(s => { setStats(s); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const total      = useCountUp(stats?.total      || 0);
  const interviews = useCountUp(stats?.interviews || 0);
  const pending    = useCountUp(stats?.pending    || 0);

  const maxStat = stats?.byStatut ? Math.max(...stats.byStatut.map(s => Number(s.count)), 1) : 1;
  const maxLoc  = stats?.byLoc    ? Math.max(...stats.byLoc.map(l => Number(l.count)),    1) : 1;
  const maxSec  = stats?.bySec    ? Math.max(...stats.bySec.map(s => Number(s.count)),    1) : 1;

  if (loading) return (
    <div className="stats-page">
      <div className="loading"><div className="spinner" /></div>
    </div>
  );

  return (
    <div className="stats-page">
      <div className="stats-kpi-row">
        <div className="stats-kpi"><span className="stats-kpi-val">{total}</span><span className="stats-kpi-lbl">Candidatures</span></div>
        <div className="stats-kpi"><span className="stats-kpi-val" style={{ color: '#00d4a0' }}>{interviews}</span><span className="stats-kpi-lbl">Entretiens</span></div>
        <div className="stats-kpi"><span className="stats-kpi-val" style={{ color: '#ff9f43' }}>{pending}</span><span className="stats-kpi-lbl">Relances</span></div>
        <div className="stats-kpi"><span className="stats-kpi-val" style={{ color: '#2563eb' }}>{stats?.byLoc?.length || 0}</span><span className="stats-kpi-lbl">Villes</span></div>
      </div>

      {stats?.history?.length > 0 && (
        <div className="stats-card">
          <div className="stats-section-title">Candidatures (14 derniers jours)</div>
          <HistoryChart history={stats.history} />
        </div>
      )}

      <div className="stats-cols">
        {stats?.byStatut?.length > 0 && (
          <div className="stats-card">
            <div className="stats-section-title">Par statut</div>
            {stats.byStatut.map(s => (
              <HorizBar
                key={s.statut}
                label={s.statut}
                count={Number(s.count)}
                max={maxStat}
                color={STATUT_COLORS[s.statut] || '#888'}
              />
            ))}
          </div>
        )}

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

      {!stats?.total && (
        <div className="stats-empty">Aucune donnée disponible. Ajoutez des candidatures pour voir les statistiques.</div>
      )}
    </div>
  );
}
