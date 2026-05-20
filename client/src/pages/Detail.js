import React, { useEffect, useState } from 'react';
import { api } from '../hooks/api';
import './Detail.css';

const STATUTS = ['Postulé','En attente','En attente de réponse','Entretien','Refus','Sans suite'];
const STATUT_COLORS = {
  'Postulé':'#4ecdc4','En attente':'#ff9f43','En attente de réponse':'#ffd93d',
  'Entretien':'#00d4a0','Refus':'#ff6b6b','Sans suite':'#6b6b80'
};
const TYPES_ECHANGE = ['Email reçu','Email envoyé','Appel téléphonique','Message LinkedIn','Entretien','Relance','Note'];

export default function Detail({ id, navigate }) {
  const [cand, setCand] = useState(null);
  const [echanges, setEchanges] = useState([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [newEchange, setNewEchange] = useState({ type:'Email reçu', contenu:'', date: new Date().toISOString().split('T')[0] });
  const [showEchangeForm, setShowEchangeForm] = useState(false);

  const load = async () => {
    const all = await api.get('/api/candidatures');
    const c = all.find(x => x.id === id);
    if (c) { setCand(c); setForm({...c}); }
    const ex = await api.get(`/api/candidatures/${id}/echanges`);
    setEchanges(ex);
  };

  useEffect(() => { load(); }, [id]);

  const save = async () => {
    await api.put(`/api/candidatures/${id}`, form);
    setEditing(false); load();
  };

  const addEchange = async () => {
    if (!newEchange.contenu.trim()) return;
    await api.post(`/api/candidatures/${id}/echanges`, newEchange);
    setNewEchange({ type:'Email reçu', contenu:'', date: new Date().toISOString().split('T')[0] });
    setShowEchangeForm(false); load();
  };

  const delEchange = async (eid) => {
    if (window.confirm('Supprimer cet échange ?')) {
      await api.delete(`/api/echanges/${eid}`); load();
    }
  };

  if (!cand) return <div className="loading"><div className="spinner" /></div>;

  return (
    <div className="detail-page">
      <button className="back-btn" onClick={() => navigate('candidatures')}>← Retour</button>

      <div className="detail-header">
        <div className="detail-avatar">{cand.entreprise[0]}</div>
        <div className="detail-info">
          <h1 className="detail-entreprise">{cand.entreprise}</h1>
          <p className="detail-poste">{cand.poste}</p>
        </div>
        <span className="badge-lg" style={{background: STATUT_COLORS[cand.statut]+'22', color: STATUT_COLORS[cand.statut]}}>
          {cand.statut}
        </span>
      </div>

      <div className="detail-grid">
        <div className="card">
          <div className="card-title-row">
            <h2 className="card-title">Informations</h2>
            {!editing
              ? <button className="btn-ghost" onClick={() => setEditing(true)}>✏️ Modifier</button>
              : <div style={{display:'flex',gap:8}}>
                  <button className="btn-ghost" onClick={() => setEditing(false)}>Annuler</button>
                  <button className="btn-primary-sm" onClick={save}>Sauvegarder</button>
                </div>
            }
          </div>

          {editing ? (
            <div className="edit-form">
              {[['Entreprise','entreprise'],['Poste','poste'],['Source','source'],['Date','date_candidature'],['Contact','contact']].map(([label, key]) => (
                <div className="form-group" key={key}>
                  <label>{label}</label>
                  <input value={form[key]||''} onChange={e => setForm({...form,[key]:e.target.value})} type={key==='date_candidature'?'date':'text'} />
                </div>
              ))}
              <div className="form-group">
                <label>Statut</label>
                <select value={form.statut} onChange={e => setForm({...form,statut:e.target.value})}>
                  {STATUTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea value={form.notes||''} onChange={e => setForm({...form,notes:e.target.value})} rows={3} />
              </div>
            </div>
          ) : (
            <div className="info-list">
              {[['📍 Source', cand.source],['📅 Date', cand.date_candidature],['👤 Contact', cand.contact]].map(([label, val]) => val ? (
                <div className="info-row" key={label}>
                  <span className="info-label">{label}</span>
                  <span className="info-val">{val}</span>
                </div>
              ) : null)}
              {cand.notes && (
                <div className="notes-block">
                  <span className="info-label">📝 Notes</span>
                  <p>{cand.notes}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-title-row">
            <h2 className="card-title">Historique ({echanges.length})</h2>
            <button className="btn-ghost" onClick={() => setShowEchangeForm(!showEchangeForm)}>+ Ajouter</button>
          </div>

          {showEchangeForm && (
            <div className="echange-form">
              <div className="form-group">
                <label>Type</label>
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
              <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
                <button className="btn-ghost" onClick={() => setShowEchangeForm(false)}>Annuler</button>
                <button className="btn-primary-sm" onClick={addEchange}>Ajouter</button>
              </div>
            </div>
          )}

          <div className="timeline">
            {echanges.length === 0 && <p className="empty-small">Aucun échange enregistré</p>}
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
    </div>
  );
}
