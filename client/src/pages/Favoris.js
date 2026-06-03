import React, { useEffect, useState, useCallback } from 'react';
import { api }  from '../hooks/api';
import { SOURCE_COLORS, SOURCE_LABELS } from '../App';
import './Favoris.css';

function daysSince(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  const diff = Math.floor((Date.now() - d) / 86400000);
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return 'Hier';
  return `Il y a ${diff}j`;
}

function FavoriCard({ offre, onUnfav, onClick }) {
  const srcColor = SOURCE_COLORS[offre.source] || '#666';
  const scoreColor = offre.score_match >= 70 ? '#00d4a0' : offre.score_match >= 40 ? '#ff9f43' : '#888';

  return (
    <div className="fav-card" onClick={() => onClick(offre.id)}>
      <div className="fav-card-top">
        <div className="fav-avatar">{(offre.entreprise?.[0] || offre.titre?.[0] || '?').toUpperCase()}</div>
        <div className="fav-info">
          <div className="fav-titre">{offre.titre}</div>
          <div className="fav-sub">
            {offre.entreprise   && <span>{offre.entreprise}</span>}
            {offre.localisation && <span>📍 {offre.localisation}</span>}
            {offre.salaire      && <span>💰 {offre.salaire}</span>}
          </div>
        </div>
        <button
          className="unfav-btn"
          onClick={e => { e.stopPropagation(); onUnfav(offre); }}
          title="Retirer des favoris"
        >❤️</button>
      </div>

      <div className="fav-card-bottom">
        <span className="source-badge" style={{ background: srcColor + '22', color: srcColor }}>
          {SOURCE_LABELS[offre.source] || offre.source}
        </span>
        {offre.date_publi && <span className="fav-date">{daysSince(offre.date_publi)}</span>}
        {offre.score_match > 0 && (
          <span className="fav-score" style={{ color: scoreColor }}>{offre.score_match}%</span>
        )}
        {offre.source_url && (
          <a
            className="fav-apply"
            href={offre.source_url}
            target="_blank" rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
          >
            Postuler →
          </a>
        )}
      </div>

      {offre.note && <div className="fav-note">📝 {offre.note.slice(0, 120)}{offre.note.length > 120 ? '…' : ''}</div>}
    </div>
  );
}

export default function Favoris({ navigate }) {
  const [favoris,  setFavoris]  = useState([]);
  const [loading,  setLoading]  = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get('/api/offres?favori=1&limit=200');
      setFavoris(data.offres || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, []);

  const handleUnfav = async (offre) => {
    setFavoris(prev => prev.filter(o => o.id !== offre.id));
    api.patch(`/api/offres/${offre.id}`, { favori: 0 }).catch(() => load());
  };

  return (
    <div className="favoris-page">
      <div className="favoris-header">
        <h1 className="page-title">❤️ Favoris</h1>
        {!loading && <span className="fav-count">{favoris.length} offre{favoris.length !== 1 ? 's' : ''} sauvegardée{favoris.length !== 1 ? 's' : ''}</span>}
      </div>

      {loading ? (
        <div className="fav-loading">Chargement…</div>
      ) : favoris.length === 0 ? (
        <div className="fav-empty">
          <div className="empty-icon">🤍</div>
          <p>Aucun favori pour l'instant.</p>
          <p style={{ fontSize: '.85rem' }}>Clique sur le cœur d'une offre pour la sauvegarder.</p>
          <button className="go-offres-btn" onClick={() => navigate('offres')}>Voir les offres</button>
        </div>
      ) : (
        <div className="fav-list">
          {favoris.map(o => (
            <FavoriCard
              key={o.id} offre={o}
              onUnfav={handleUnfav}
              onClick={id => navigate('detail', id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
