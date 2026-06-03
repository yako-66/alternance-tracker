import React, { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../hooks/api';
import { SOURCE_COLORS, SOURCE_LABELS } from '../App';
import './DetailOffre.css';

function daysSince(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  const diff = Math.floor((Date.now() - d) / 86400000);
  if (diff === 0) return "Publiée aujourd'hui";
  if (diff === 1) return 'Publiée hier';
  return `Publiée il y a ${diff} jours`;
}

export default function DetailOffre({ id, navigate }) {
  const [offre,      setOffre]      = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [note,       setNote]       = useState('');
  const [noteSaved,  setNoteSaved]  = useState(false);
  const noteTimer = useRef(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api.get(`/api/offres/${id}`)
      .then(o => { setOffre(o); setNote(o.note || ''); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  const toggleFavori = useCallback(async () => {
    if (!offre) return;
    const next = offre.favori ? 0 : 1;
    setOffre(o => ({ ...o, favori: next }));
    api.patch(`/api/offres/${offre.id}`, { favori: next }).catch(() => setOffre(o => ({ ...o, favori: offre.favori })));
  }, [offre]);

  const saveNote = useCallback(async (val) => {
    if (!offre) return;
    await api.patch(`/api/offres/${offre.id}`, { note: val }).catch(() => {});
    setNoteSaved(true);
    setTimeout(() => setNoteSaved(false), 1500);
  }, [offre]);

  const handleNoteChange = (e) => {
    const val = e.target.value;
    setNote(val);
    clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => saveNote(val), 800);
  };

  const archive = async () => {
    await api.patch(`/api/offres/${offre.id}`, { archived: 1 });
    navigate('offres');
  };

  if (loading) return <div className="detail-loading"><div className="loading-spinner" />Chargement…</div>;
  if (!offre)  return <div className="detail-loading">Offre introuvable.</div>;

  const srcColor = SOURCE_COLORS[offre.source] || '#666';
  const scoreColor = offre.score_match >= 70 ? '#00d4a0' : offre.score_match >= 40 ? '#ff9f43' : '#888';

  return (
    <div className="detail-page">
      <button className="detail-back" onClick={() => navigate('offres')}>← Retour aux offres</button>

      <div className="detail-card">
        {/* Header */}
        <div className="detail-header">
          <div className="detail-avatar">{(offre.entreprise?.[0] || offre.titre?.[0] || '?').toUpperCase()}</div>
          <div className="detail-titles">
            <h1 className="detail-titre">{offre.titre}</h1>
            <div className="detail-sub">
              {offre.entreprise   && <span className="detail-company">{offre.entreprise}</span>}
              {offre.localisation && <span>📍 {offre.localisation}</span>}
              {offre.salaire      && <span>💰 {offre.salaire}</span>}
            </div>
          </div>
          <div className="detail-ctas">
            <button className={`fav-btn-lg ${offre.favori ? 'on' : ''}`} onClick={toggleFavori}>
              {offre.favori ? '❤️ Favori' : '🤍 Favoriser'}
            </button>
            {offre.source_url && (
              <a className="apply-btn" href={offre.source_url} target="_blank" rel="noopener noreferrer">
                🔗 Voir l'offre
              </a>
            )}
          </div>
        </div>

        {/* Badges */}
        <div className="detail-badges">
          <span className="source-badge" style={{ background: srcColor + '22', color: srcColor }}>
            {SOURCE_LABELS[offre.source] || offre.source}
          </span>
          {offre.date_publi && <span className="badge-date">{daysSince(offre.date_publi)}</span>}
          {offre.secteur    && <span className="badge-sec">{offre.secteur}</span>}
          {offre.tags?.split(',').filter(Boolean).map(t => (
            <span key={t} className="badge-tag">{t.trim()}</span>
          ))}
        </div>

        {/* Score match */}
        {offre.score_match > 0 && (
          <div className="detail-score">
            <span className="score-label">Match profil Sys & Réseaux</span>
            <div className="score-track">
              <div className="score-fill" style={{ width: `${offre.score_match}%`, background: scoreColor }} />
            </div>
            <span className="score-val" style={{ color: scoreColor }}>{offre.score_match}%</span>
          </div>
        )}

        {/* Description */}
        {offre.description ? (
          <div className="detail-desc">
            <h3>Description</h3>
            <p className="desc-text">{offre.description}</p>
          </div>
        ) : (
          <div className="detail-nodesc">
            Pas de description disponible.{' '}
            {offre.source_url && <a href={offre.source_url} target="_blank" rel="noopener noreferrer">Voir l'offre complète →</a>}
          </div>
        )}

        {/* Note personnelle */}
        <div className="detail-note">
          <h3>Note personnelle {noteSaved && <span className="note-ok">✅ Sauvegardé</span>}</h3>
          <textarea
            className="note-input"
            value={note}
            onChange={handleNoteChange}
            placeholder="Contact recruteur, infos entreprise, points à vérifier…"
            rows={4}
          />
        </div>

        {/* Footer */}
        <div className="detail-footer">
          <button className="archive-btn" onClick={archive}>🗃️ Archiver</button>
          <button className="delete-btn" onClick={async () => { await api.delete(`/api/offres/${offre.id}`); navigate('offres'); }}>
            🗑️ Supprimer
          </button>
        </div>
      </div>
    </div>
  );
}
