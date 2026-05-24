import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../hooks/api';
import Confetti from '../components/Confetti';
import './Detail.css';

const DEFAULT_CHECKLIST = [
  { text: "Rechercher l'entreprise (valeurs, actualité, concurrents)", done: false },
  { text: 'Préparer 3 questions à poser au recruteur', done: false },
  { text: "Confirmer le lieu, l'heure et le format de l'entretien", done: false },
  { text: 'Préparer ma tenue la veille', done: false },
  { text: "Relire l'offre d'emploi et identifier les mots-clés", done: false },
  { text: 'Revoir mon parcours et préparer le pitch de 2 min', done: false },
  { text: 'Imprimer 2 exemplaires de mon CV', done: false },
];

function completionScore(c) {
  const checks = [!!c.entreprise, !!c.poste, !!c.source, !!c.contact, !!c.localisation, !!c.notes, !!c.date_candidature, !!c.date_entretien, (c.score||0)>0];
  return Math.round(checks.filter(Boolean).length / checks.length * 100);
}

const STATUTS = ['Postulé','En attente','En attente de réponse','Entretien','Refus','Sans suite'];
const STATUT_COLORS = {
  'Postulé':'#4ecdc4','En attente':'#ff9f43','En attente de réponse':'#f5c842',
  'Entretien':'#00c48c','Refus':'#e84f4f','Sans suite':'#9a9aa8'
};
const TYPES_ECHANGE = ['Email reçu','Email envoyé','Appel téléphonique','Message LinkedIn','Entretien','Relance','Note'];

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.includes('/') ? dateStr.split('/').reverse() : dateStr.split('-');
  const d = new Date(parts.join('-')); d.setHours(0,0,0,0);
  if (isNaN(d)) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  return Math.ceil((d - today) / 86400000);
}

const RELANCE_TEMPLATES = [
  { title: '📧 Relance standard', body: (e,p) => `Objet : Suivi — ${p} chez ${e}\n\nMadame, Monsieur,\n\nJe me permets de revenir vers vous concernant ma candidature au poste de ${p}.\n\nMon intérêt pour ${e} reste intact. Pourriez-vous me tenir informé(e) de l'avancement de votre processus de recrutement ?\n\nCordialement` },
  { title: '🎯 Après entretien', body: (e,p) => `Objet : Merci — Entretien ${p} chez ${e}\n\nMadame, Monsieur,\n\nJe vous remercie pour le temps que vous m'avez accordé lors de notre entretien. Cet échange a renforcé mon enthousiasme pour le poste de ${p} chez ${e}.\n\nDans l'attente de votre retour, cordialement` },
  { title: '🔁 Deuxième relance', body: (e,p) => `Objet : Deuxième suivi — ${p} chez ${e}\n\nMadame, Monsieur,\n\nJe reviens vers vous une deuxième fois concernant le poste de ${p}. Je comprends que vos délais puissent être longs, mais je reste très motivé(e) à rejoindre ${e}.\n\nCordialement` },
];

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
  const [showTemplates, setShowTemplates] = useState(false);
  const [copiedTemplate, setCopiedTemplate] = useState(-1);
  const [checklist, setChecklist] = useState([]);
  const [newCheckItem, setNewCheckItem] = useState('');
  const checklistLoaded = React.useRef(false);

  const copyTemplate = (text, idx) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedTemplate(idx);
      setTimeout(() => setCopiedTemplate(-1), 2000);
      showToast('📋 Template copié dans le presse-papier !');
    }).catch(() => showToast('Copie non supportée dans ce navigateur'));
  };

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

  useEffect(() => {
    if (!id || checklistLoaded.current) return;
    const saved = localStorage.getItem(`checklist_${id}`);
    setChecklist(saved ? JSON.parse(saved) : DEFAULT_CHECKLIST.map(i => ({...i})));
    checklistLoaded.current = true;
  }, [id]);

  const saveChecklist = (updated) => {
    setChecklist(updated);
    localStorage.setItem(`checklist_${id}`, JSON.stringify(updated));
  };

  const toggleCheck = (i) => saveChecklist(checklist.map((item, idx) => idx === i ? {...item, done: !item.done} : item));
  const removeCheckItem = (i) => saveChecklist(checklist.filter((_, idx) => idx !== i));
  const addCheckItem = () => {
    if (!newCheckItem.trim()) return;
    saveChecklist([...checklist, { text: newCheckItem.trim(), done: false }]);
    setNewCheckItem('');
  };
  const resetChecklist = () => saveChecklist(DEFAULT_CHECKLIST.map(i => ({...i})));

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
            {(() => {
              const score = completionScore(cand);
              return (
                <div className="detail-completion-wrap">
                  <div className="detail-completion-bar">
                    <div className="detail-completion-fill" style={{width:`${score}%`}} />
                  </div>
                  <span className="detail-completion-label">{score}% complet</span>
                </div>
              );
            })()}
            {cand.date_entretien && (() => {
              const days = daysUntil(cand.date_entretien);
              if (days === null) return null;
              const label = days < 0
                ? `Entretien passé il y a ${Math.abs(days)} jour${Math.abs(days) > 1 ? 's' : ''}`
                : days === 0 ? "🎯 Entretien aujourd'hui !"
                : days === 1 ? '🎯 Entretien demain !'
                : `🎯 Entretien dans ${days} jours`;
              const bg = days < 0 ? 'rgba(150,150,180,0.15)' : days <= 1 ? 'rgba(239,68,68,0.18)' : days <= 3 ? 'rgba(245,158,11,0.18)' : 'rgba(0,212,160,0.18)';
              const col = days < 0 ? 'rgba(255,255,255,0.6)' : days <= 1 ? '#fca5a5' : days <= 3 ? '#fcd34d' : '#6ee7b7';
              return <div className="detail-interview-badge" style={{background:bg,color:col}}>{label} · {cand.date_entretien}</div>;
            })()}
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
                <label>Date d'entretien</label>
                <input type="date" value={form.date_entretien||''} onChange={e => setForm({...form,date_entretien:e.target.value})} />
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
                ['🎯 Date entretien', cand.date_entretien],
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
            <div style={{display:'flex',gap:6}}>
              <button className="btn-templates" onClick={() => setShowTemplates(!showTemplates)}>
                {showTemplates ? '✕ Templates' : '📋 Templates'}
              </button>
              <button className="btn-add-echange" onClick={() => setShowEchangeForm(!showEchangeForm)}>
                {showEchangeForm ? '✕' : '+ Ajouter'}
              </button>
            </div>
          </div>

          {showTemplates && (
            <div className="templates-panel">
              <div className="templates-label">Copier un email type :</div>
              <div className="templates-list">
                {RELANCE_TEMPLATES.map((t, idx) => (
                  <button
                    key={idx}
                    className={`btn-template ${copiedTemplate === idx ? 'copied' : ''}`}
                    onClick={() => copyTemplate(t.body(cand.entreprise, cand.poste || 'le poste'), idx)}
                  >
                    {copiedTemplate === idx ? '✓ Copié !' : t.title}
                  </button>
                ))}
              </div>
            </div>
          )}

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

      {/* CHECKLIST */}
      {(() => {
        const doneCount = checklist.filter(i => i.done).length;
        const total = checklist.length;
        const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;
        return (
          <div className="card checklist-card">
            <div className="card-title-row">
              <h2 className="card-title">✅ Checklist avant entretien</h2>
              <button className="checklist-reset-btn" onClick={resetChecklist} title="Réinitialiser">↺ Réinitialiser</button>
            </div>
            <div className="checklist-progress">
              <div className="checklist-progress-track">
                <div className="checklist-progress-fill" style={{width:`${pct}%`}} />
              </div>
              {doneCount === total && total > 0
                ? <span className="checklist-all-done">🎉 Tout prêt !</span>
                : <span className="checklist-progress-label">{doneCount}/{total}</span>
              }
            </div>
            <div className="checklist-items">
              {checklist.map((item, i) => (
                <div key={i} className={`checklist-item ${item.done ? 'done' : ''}`} onClick={() => toggleCheck(i)}>
                  <div className="checklist-checkbox">{item.done ? '✓' : ''}</div>
                  <span className="checklist-text">{item.text}</span>
                  <button className="checklist-del" onClick={e => { e.stopPropagation(); removeCheckItem(i); }} title="Supprimer">×</button>
                </div>
              ))}
            </div>
            <div className="checklist-add-row">
              <input
                className="checklist-add-input"
                placeholder="Ajouter une tâche..."
                value={newCheckItem}
                onChange={e => setNewCheckItem(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addCheckItem(); }}
              />
              <button className="checklist-add-btn" onClick={addCheckItem}>+ Ajouter</button>
            </div>
          </div>
        );
      })()}

      {toast && <div className={`toast ${toastType === 'success' ? 'toast-success' : ''}`}>{toast}</div>}
    </div>
  );
}
