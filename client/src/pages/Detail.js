import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../hooks/api';
import Confetti from '../components/Confetti';
import './Detail.css';

const STATUTS = ['Postulé','En attente','En attente de réponse','Entretien','Refus','Sans suite'];
const STATUT_COLORS = {
  'Postulé':'#4ecdc4','En attente':'#ff9f43','En attente de réponse':'#f5c842',
  'Entretien':'#00c48c','Refus':'#e84f4f','Sans suite':'#9a9aa8'
};
const TYPES_ECHANGE = ['Email reçu','Email envoyé','Appel téléphonique','Message LinkedIn','Entretien','Relance','Note'];

function MapEmbed({ localisation }) {
  const [mapUrl, setMapUrl] = useState('');
  const [coords, setCoords] = useState(null);

  useEffect(() => {
    if (!localisation) return;
    fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(localisation)}&format=json&limit=1`)
      .then(r => r.json())
      .then(data => {
        if (data && data[0]) {
          const { lat, lon, display_name } = data[0];
          setCoords({ lat, lon, display_name });
          setMapUrl(`https://www.openstreetmap.org/export/embed.html?bbox=${parseFloat(lon)-0.05},${parseFloat(lat)-0.05},${parseFloat(lon)+0.05},${parseFloat(lat)+0.05}&layer=mapnik&marker=${lat},${lon}`);
        }
      })
      .catch(() => {});
  }, [localisation]);

  if (!localisation) return null;
  if (!mapUrl) return <div className="map-loading">🗺️ Chargement de la carte...</div>;

  return (
    <div className="map-wrap">
      <iframe title="Localisation" src={mapUrl} className="map-iframe" loading="lazy" />
      <div className="map-label">📍 {coords?.display_name || localisation}</div>
    </div>
  );
}

function CompanyLogo({ entreprise }) {
  const [logo, setLogo] = useState('');

  useEffect(() => {
    if (!entreprise) return;
    const domain = entreprise.toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .replace(/(sas|sarl|sa|srl|group|groupe|france)/g, '');
    const url = `https://logo.clearbit.com/${domain}.com`;
    const img = new Image();
    img.onload = () => setLogo(url);
    img.src = url;
  }, [entreprise]);

  if (logo) return <img src={logo} alt={entreprise} className="company-logo" />;
  return <div className="detail-avatar-fallback">{entreprise?.[0]?.toUpperCase()}</div>;
}

function StarRating({ value, onChange, readOnly = false }) {
  const [hover, setHover] = useState(0);
  const display = hover || value || 0;
  return (
    <div className={`star-rating-detail ${readOnly ? 'readonly' : ''}`}>
      {[1,2,3,4,5].map(i => (
        <button
          key={i}
          type="button"
          className={`star-btn-detail ${i <= display ? 'on' : ''}`}
          onMouseEnter={() => !readOnly && setHover(i)}
          onMouseLeave={() => !readOnly && setHover(0)}
          onClick={() => !readOnly && onChange && onChange(i === value ? 0 : i)}
          tabIndex={readOnly ? -1 : 0}
        >
          {i <= display ? '★' : '☆'}
        </button>
      ))}
      {!readOnly && value > 0 && (
        <button className="star-clear-btn" onClick={() => onChange(0)} title="Effacer">×</button>
      )}
    </div>
  );
}

export default function Detail({ id, navigate }) {
  const [cand, setCand] = useState(null);
  const [echanges, setEchanges] = useState([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [newEchange, setNewEchange] = useState({ type:'Email reçu', contenu:'', date:new Date().toISOString().split('T')[0] });
  const [showEchangeForm, setShowEchangeForm] = useState(false);
  const [toast, setToast] = useState('');
  const [toastType, setToastType] = useState('');
  const [saving, setSaving] = useState(false);
  const [confetti, setConfetti] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const showToast = (msg, type = '') => {
    setToast(msg);
    setToastType(type);
    setTimeout(() => setToast(''), 3500);
  };

  const load = useCallback(async () => {
    const all = await api.get('/api/candidatures');
    const c = all.find(x => x.id === id);
    if (c) { setCand(c); setForm({...c}); }
    api.get(`/api/candidatures/${id}/echanges`).then(setEchanges);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    const prevStatut = cand?.statut;
    await api.put(`/api/candidatures/${id}`, form);
    setSaving(false);
    setEditing(false);
    if (form.statut === 'Entretien' && prevStatut !== 'Entretien') {
      setConfetti(true);
      showToast('🎉 Entretien décroché ! Félicitations !', 'success');
    } else {
      showToast('✅ Modifié avec succès !');
    }
    load();
  };

  const togglePrio = async () => {
    const newPrio = cand.priorite ? 0 : 1;
    await api.put(`/api/candidatures/${id}`, { ...cand, priorite: newPrio });
    load();
    showToast(newPrio ? '🔥 Marqué prioritaire !' : 'Priorité retirée');
  };

  const deleteCand = async () => {
    await api.delete(`/api/candidatures/${id}`);
    navigate('candidatures');
  };

  const addEchange = async () => {
    if (!newEchange.contenu.trim()) return;
    await api.post(`/api/candidatures/${id}/echanges`, newEchange);
    setNewEchange({ type:'Email reçu', contenu:'', date:new Date().toISOString().split('T')[0] });
    setShowEchangeForm(false);
    load();
    showToast('✅ Échange ajouté !');
  };

  const delEchange = async (eid) => {
    if (window.confirm('Supprimer cet échange ?')) {
      await api.delete(`/api/echanges/${eid}`);
      load();
    }
  };

  if (!cand) return <div className="loading"><div className="spinner" /></div>;

  const color = STATUT_COLORS[cand.statut] || '#9a9aa8';

  return (
    <div className="detail-page">
      <Confetti active={confetti} onDone={() => setConfetti(false)} />

      <div className="detail-topbar">
        <button className="back-btn" onClick={() => navigate('candidatures')}>← Retour aux candidatures</button>
        <button className="btn-delete-outline" onClick={() => setShowDeleteConfirm(true)}>🗑 Supprimer</button>
      </div>

      {showDeleteConfirm && (
        <div className="delete-confirm-banner">
          <span>Supprimer <strong>{cand.entreprise}</strong> définitivement ?</span>
          <div style={{display:'flex',gap:8}}>
            <button className="btn-confirm-delete" onClick={deleteCand}>Oui, supprimer</button>
            <button className="btn-cancel-delete" onClick={() => setShowDeleteConfirm(false)}>Annuler</button>
          </div>
        </div>
      )}

      {/* HERO */}
      <div className={`detail-hero ${cand.priorite ? 'hero-prioritaire' : ''}`}>
        <div className="detail-hero-left">
          <CompanyLogo entreprise={cand.entreprise} />
          <div className="detail-hero-info">
            <div className="detail-hero-name-row">
              <h1 className="detail-entreprise">{cand.entreprise}</h1>
              {cand.priorite ? <span className="detail-prio-badge">🔥 Prioritaire</span> : null}
            </div>
            <p className="detail-poste">{cand.poste || 'Poste non renseigné'}</p>
            {(cand.score > 0) && (
              <div className="detail-score-row">
                {[1,2,3,4,5].map(i => (
                  <span key={i} className={`detail-star ${i <= cand.score ? 'on' : ''}`}>★</span>
                ))}
                <span className="detail-score-label">{cand.score}/5</span>
              </div>
            )}
            <div className="detail-hero-meta">
              {cand.localisation && <span className="detail-chip">📍 {cand.localisation}</span>}
              {cand.source && <span className="detail-chip">🔗 {cand.source}</span>}
              {cand.date_candidature && <span className="detail-chip">📅 {cand.date_candidature}</span>}
              {cand.contact && <span className="detail-chip">👤 {cand.contact}</span>}
            </div>
          </div>
        </div>
        <div className="detail-hero-right">
          <span className="statut-pill" style={{background: color+'25', color: color, borderColor: color+'40'}}>
            {cand.statut}
          </span>
          <div className="detail-hero-actions">
            <button
              className={`btn-prio-hero ${cand.priorite ? 'active' : ''}`}
              onClick={togglePrio}
              title={cand.priorite ? 'Retirer priorité' : 'Marquer prioritaire'}
            >
              🔥
            </button>
            {!editing
              ? <button className="btn-edit" onClick={() => setEditing(true)}>✏️ Modifier</button>
              : <>
                  <button className="btn-cancel" onClick={() => { setEditing(false); setForm({...cand}); }}>Annuler</button>
                  <button className="btn-save-primary" onClick={save} disabled={saving}>
                    {saving ? '⏳' : '💾 Sauvegarder'}
                  </button>
                </>
            }
          </div>
        </div>
      </div>

      {/* MAP */}
      {cand.localisation && !editing && <MapEmbed localisation={cand.localisation} />}

      <div className="detail-grid">
        {/* INFOS */}
        <div className="card">
          <h2 className="card-title">📋 Informations</h2>
          {editing ? (
            <div className="edit-form">
              {[['Entreprise','entreprise'],['Poste','poste'],['Localisation','localisation'],['Source','source'],['Contact','contact']].map(([label, key]) => (
                <div className="form-group" key={key}>
                  <label>{label}</label>
                  <input value={form[key]||''} onChange={e => setForm({...form,[key]:e.target.value})} />
                </div>
              ))}
              <div className="form-group">
                <label>Date de candidature</label>
                <input type="date" value={form.date_candidature||''} onChange={e => setForm({...form,date_candidature:e.target.value})} />
              </div>
              <div className="form-group">
                <label>Statut</label>
                <select value={form.statut} onChange={e => setForm({...form,statut:e.target.value})}>
                  {STATUTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Score attractivité</label>
                <StarRating value={form.score || 0} onChange={v => setForm({...form, score: v})} />
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea value={form.notes||''} onChange={e => setForm({...form,notes:e.target.value})} rows={4} />
              </div>
            </div>
          ) : (
            <div className="info-list">
              {[
                ['📍 Localisation', cand.localisation],
                ['💼 Poste', cand.poste],
                ['🔗 Source', cand.source],
                ['📅 Date candidature', cand.date_candidature],
                ['👤 Contact', cand.contact],
              ].map(([label, val]) => val ? (
                <div className="info-row" key={label}>
                  <span className="info-label">{label}</span>
                  <span className="info-val">{val}</span>
                </div>
              ) : null)}
              {cand.score > 0 && (
                <div className="info-row">
                  <span className="info-label">⭐ Score</span>
                  <span className="info-val"><StarRating value={cand.score} readOnly /></span>
                </div>
              )}
              {cand.notes && (
                <div className="notes-block">
                  <div className="notes-label">📝 Notes</div>
                  <p>{cand.notes}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ÉCHANGES */}
        <div className="card">
          <div className="card-title-row">
            <h2 className="card-title">💬 Historique ({echanges.length})</h2>
            <button className="btn-add-echange" onClick={() => setShowEchangeForm(!showEchangeForm)}>
              {showEchangeForm ? '✕' : '+ Ajouter'}
            </button>
          </div>

          {showEchangeForm && (
            <div className="echange-form">
              <div className="form-group">
                <label>Type d'échange</label>
                <select value={newEchange.type} onChange={e => setNewEchange({...newEchange,type:e.target.value})}>
                  {TYPES_ECHANGE.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Date</label>
                <input type="date" value={newEchange.date} onChange={e => setNewEchange({...newEchange,date:e.target.value})} />
              </div>
              <div className="form-group">
                <label>Contenu</label>
                <textarea value={newEchange.contenu} onChange={e => setNewEchange({...newEchange,contenu:e.target.value})} rows={3} placeholder="Décris l'échange..." />
              </div>
              <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:4}}>
                <button className="btn-cancel" onClick={() => setShowEchangeForm(false)}>Annuler</button>
                <button className="btn-save-primary" onClick={addEchange}>Ajouter</button>
              </div>
            </div>
          )}

          <div className="timeline">
            {echanges.length === 0 && <p className="empty-small">Aucun échange enregistré pour l'instant</p>}
            {echanges.map(e => (
              <div className="timeline-item" key={e.id}>
                <div className="timeline-dot" />
                <div className="timeline-content">
                  <div className="timeline-header">
                    <span className="timeline-type">{e.type}</span>
                    <span className="timeline-date">{e.date}</span>
                    <button className="icon-btn-sm" onClick={() => delEchange(e.id)}>×</button>
                  </div>
                  <p className="timeline-text">{e.contenu}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {toast && <div className={`toast ${toastType === 'success' ? 'toast-success' : ''}`}>{toast}</div>}
    </div>
  );
}
