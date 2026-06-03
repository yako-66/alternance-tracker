import React, { useEffect, useRef, useState } from 'react';
import { api } from '../hooks/api';
import { SOURCE_COLORS, SOURCE_LABELS } from '../App';
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
  'Un score de matching élevé signifie que l\'offre correspond à ton profil IT. Vise les offres > 60%.',
  'La Bonne Alternance est mise à jour quotidiennement par Pôle Emploi. Consulte-la en priorité.',
  'Hésite pas à ajouter une note sur chaque offre : contact RH, infos clés, points à vérifier.',
  'France Travail contient des offres exclusives avec salaire détaillé. Active les clés API !',
  'Favorise les offres qui t\'intéressent et va les voir dans "Favoris" pour retrouver facilement.',
  'Le scraping se relance automatiquement toutes les 6h. Tu peux aussi le forcer manuellement.',
  'Les offres marquées "Nouveau" n\'ont jamais été ouvertes. Commence par celles-là.',
];

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

function SourceBar({ name, count, max, color }) {
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

function OffrePreview({ offre, navigate }) {
  if (!offre) return null;
  const srcColor = SOURCE_COLORS[offre.source] || '#666';
  const scoreColor = offre.score_match >= 70 ? '#00d4a0' : offre.score_match >= 40 ? '#ff9f43' : '#888';
  return (
    <div className="preview-card" onClick={() => navigate('detail', offre.id)}>
      <div className="preview-avatar">{(offre.entreprise?.[0] || offre.titre?.[0] || '?').toUpperCase()}</div>
      <div className="preview-info">
        <div className="preview-titre">{offre.titre}</div>
        <div className="preview-sub">{offre.entreprise} · {offre.localisation}</div>
      </div>
      {offre.score_match > 0 && (
        <span className="preview-score" style={{ color: scoreColor }}>{offre.score_match}%</span>
      )}
      <span className="preview-src" style={{ background: srcColor + '22', color: srcColor }}>
        {SOURCE_LABELS[offre.source] || offre.source}
      </span>
    </div>
  );
}

export default function Dashboard({ navigate }) {
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [tip,     setTip]     = useState('');

  useEffect(() => {
    setTip(TIPS[Math.floor(Math.random() * TIPS.length)]);
    api.get('/api/offres/stats').then(s => { setStats(s); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const maxSrc = stats?.bySrc ? Math.max(...stats.bySrc.map(s => Number(s.count)), 1) : 1;

  const lastScrape = stats?.lastScrapeAt
    ? new Date(stats.lastScrapeAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="dashboard">
      {/* KPIs */}
      <div className="kpi-row">
        <KpiCard label="Offres total"    value={loading ? 0 : stats?.total || 0}    icon="📋" color="#7c3aed" onClick={() => navigate('offres')} />
        <KpiCard label="Nouvelles"       value={loading ? 0 : stats?.nouvelles || 0} icon="✨" color="#2563eb" onClick={() => navigate('offres')} />
        <KpiCard label="Favoris"         value={loading ? 0 : stats?.favoris || 0}   icon="❤️" color="#e11d48" onClick={() => navigate('favoris')} />
        <KpiCard label="Sources actives" value={loading ? 0 : stats?.bySrc?.length || 0} icon="🔗" color="#16a34a" />
      </div>

      <div className="dash-grid">
        {/* Dernière scraping + tip */}
        <div className="dash-section">
          <div className="section-title">Info scraping</div>
          {lastScrape && (
            <div className="scrape-info">
              <span>Dernier scraping : <strong>{lastScrape}</strong></span>
            </div>
          )}
          <div className="tip-box">
            <span className="tip-icon">💡</span>
            <span>{tip}</span>
          </div>
        </div>

        {/* Répartition par source */}
        {stats?.bySrc?.length > 0 && (
          <div className="dash-section">
            <div className="section-title">Offres par source</div>
            {stats.bySrc.map(s => (
              <SourceBar
                key={s.source}
                name={SOURCE_LABELS[s.source] || s.source}
                count={Number(s.count)}
                max={maxSrc}
                color={SOURCE_COLORS[s.source] || '#666'}
              />
            ))}
          </div>
        )}

        {/* Top localisations */}
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

      {/* Meilleures offres */}
      {stats?.recent?.length > 0 && (
        <div className="dash-section" style={{ marginTop: '1.5rem' }}>
          <div className="section-title-row">
            <div className="section-title">Meilleures offres</div>
            <button className="see-all-btn" onClick={() => navigate('offres')}>Tout voir →</button>
          </div>
          {stats.recent.map(o => <OffrePreview key={o.id} offre={o} navigate={navigate} />)}
        </div>
      )}

      {/* État vide */}
      {!loading && !stats?.total && (
        <div className="dash-empty">
          <div className="dash-empty-icon">🔍</div>
          <p>Aucune offre encore scrapée.</p>
          <p style={{ fontSize: '.85rem', color: 'var(--muted)' }}>Le premier scraping démarre automatiquement au démarrage du serveur (15s).</p>
        </div>
      )}
    </div>
  );
}
