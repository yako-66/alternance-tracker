import React, { useEffect, useRef, useState } from 'react';
import { api } from '../hooks/api';
import './Dashboard.css';

function useCountUp(target, duration = 800) {
  const [count, setCount] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    if (target === prev.current) return;
    const start = Date.now(), from = prev.current, delta = target - from;
    if (!delta) return;
    const frame = () => {
      const p = Math.min((Date.now() - start) / duration, 1);
      const v = Math.round(from + (1 - Math.pow(1 - p, 3)) * delta);
      setCount(v);
      if (p < 1) requestAnimationFrame(frame);
      else { setCount(target); prev.current = target; }
    };
    requestAnimationFrame(frame);
  }, [target, duration]);
  return count;
}

const TIPS = [
  'Personnalise chaque lettre de motivation à l\'entreprise visée.',
  'Ajoute une date de rappel pour ne jamais oublier de relancer.',
  'Classe tes candidatures par priorité pour rester organisé.',
  'Note les contacts RH dès le premier échange.',
  'Un suivi régulier augmente tes chances d\'obtenir un entretien.',
  'Marque tes candidatures "Entretien" dès confirmation pour les suivre.',
  'La vue Kanban donne une vision claire de l\'avancement de tes démarches.',
];

const STATUT_COLORS = {
  'Postulé':'#4ecdc4','En attente':'#ff9f43','En attente de réponse':'#ffd93d',
  'Entretien':'#00d4a0','Refus':'#ff6b6b','Sans suite':'#4a4a60'
};

function KpiCard({ label, value, icon, color, onClick }) {
  const animated = useCountUp(value);
  return (
    <div className="kpi-card" onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      <div className="kpi-icon" style={{ background: color + '22', color }}>{icon}</div>
      <div className="kpi-body">
        <div className="kpi-value">{animated}</div>
        <div className="kpi-label">{label}</div>
      </div>
    </div>
  );
}

function StatutBar({ name, count, max, color }) {
  return (
    <div className="src-row">
      <span className="src-name">{name}</span>
      <div className="src-track">
        <div className="src-fill" style={{ width: `${Math.round((count / max) * 100)}%`, background: color }} />
      </div>
      <span className="src-count">{count}</span>
    </div>
  );
}

function CandPreview({ c, navigate }) {
  if (!c) return null;
  const color = STATUT_COLORS[c.statut] || '#888';
  return (
    <div className="preview-card" onClick={() => navigate('candidatures')}>
      <div className="preview-avatar">{(c.entreprise?.[0] || c.poste?.[0] || '?').toUpperCase()}</div>
      <div className="preview-info">
        <div className="preview-titre">{c.poste || c.entreprise}</div>
        <div className="preview-sub">{[c.entreprise, c.localisation].filter(Boolean).join(' · ') || c.entreprise}</div>
      </div>
      <span className="preview-src" style={{ background: color + '22', color }}>{c.statut}</span>
    </div>
  );
}

export default function Dashboard({ navigate }) {
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [tip,     setTip]     = useState('');

  useEffect(() => {
    setTip(TIPS[Math.floor(Math.random() * TIPS.length)]);
    api.get('/api/candidatures/stats').then(s => { setStats(s); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const maxStatut = stats?.byStatut ? Math.max(...stats.byStatut.map(s => Number(s.count)), 1) : 1;

  return (
    <div className="dashboard">
      <div className="kpi-row">
        <KpiCard label="Candidatures" value={loading ? 0 : stats?.total      || 0} icon="📝" color="#7c3aed" onClick={() => navigate('candidatures')} />
        <KpiCard label="Entretiens"   value={loading ? 0 : stats?.interviews  || 0} icon="🤝" color="#00d4a0" onClick={() => navigate('candidatures')} />
        <KpiCard label="Relances"     value={loading ? 0 : stats?.pending     || 0} icon="📨" color="#ff9f43" onClick={() => navigate('calendar')} />
        <KpiCard label="Villes"       value={loading ? 0 : stats?.byLoc?.length || 0} icon="📍" color="#2563eb" />
      </div>

      <div className="dash-grid">
        <div className="dash-section">
          <div className="section-title">Conseil du jour</div>
          <div className="tip-box">
            <span className="tip-icon">💡</span>
            <span>{tip}</span>
          </div>
        </div>

        {stats?.byStatut?.length > 0 && (
          <div className="dash-section">
            <div className="section-title">Par statut</div>
            {stats.byStatut.map(s => (
              <StatutBar
                key={s.statut}
                name={s.statut}
                count={Number(s.count)}
                max={maxStatut}
                color={STATUT_COLORS[s.statut] || '#888'}
              />
            ))}
          </div>
        )}

        {stats?.byLoc?.length > 0 && (
          <div className="dash-section">
            <div className="section-title">Top villes</div>
            {stats.byLoc.slice(0, 6).map(l => (
              <div key={l.localisation} className="loc-row">
                <span className="loc-name">{l.localisation}</span>
                <span className="loc-count">{Number(l.count)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {stats?.recent?.length > 0 && (
        <div className="dash-section" style={{ marginTop: '1rem' }}>
          <div className="section-title-row">
            <div className="section-title">Dernières candidatures</div>
            <button className="see-all-btn" onClick={() => navigate('candidatures')}>Tout voir →</button>
          </div>
          {stats.recent.map(c => <CandPreview key={c.id} c={c} navigate={navigate} />)}
        </div>
      )}

      {!loading && !stats?.total && (
        <div className="dash-empty">
          <div className="dash-empty-icon">📝</div>
          <p>Aucune candidature encore.</p>
          <button className="see-all-btn" onClick={() => navigate('candidatures')} style={{ marginTop: '1rem' }}>
            Ajouter ma première candidature →
          </button>
        </div>
      )}
    </div>
  );
}
