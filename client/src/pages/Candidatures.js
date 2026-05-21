import React, { useEffect, useState } from 'react';
import { api } from '../hooks/api';
import Modal from '../components/Modal';
import './Candidatures.css';

const STATUTS = ['Postulé','En attente','En attente de réponse','Entretien','Refus','Sans suite'];
const STATUT_COLORS = {
  'Postulé':'#4ecdc4','En attente':'#ff9f43','En attente de réponse':'#ffd93d',
  'Entretien':'#00d4a0','Refus':'#ff6b6b','Sans suite':'#4a4a60'
};

const empty = { entreprise:'', poste:'', source:'', date_candidature:'', contact:'', statut:'Postulé', notes:'', localisation:'' };

function daysSince(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.includes('/') ? dateStr.split('/').reverse() : dateStr.split('-');
  const d = new Date(parts.join('-'));
  if (isNaN(d)) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

export default function Candidatures({ navigate }) {
  const [list, setList] = useState([]);
  const [search, setSearch] = useState('');
  const [filterStatut, setFilterStatut] = useState('');
  const [view, setView] = useState('list'); // list | kanban
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [toast, setToast] = useState('');

  const load = () => api.get('/api/candidatures').then(setList);
  useEffect(() => { load(); }, []);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const filtered = list.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !q || c.entreprise.toLowerCase().includes(q) || c.poste?.toLowerCase().includes(q) || c.source?.toLowerCase().includes(q) || c.localisation?.toLowerCase().includes(q);
    const matchStatut = !filterStatut || c.statut === filterStatut;
    return matchSearch && matchStatut;
  });

  const openAdd = () => { setEditing(null); setForm(empty); setShowModal(true); };
  const openEdit = (c, e) => { e.stopPropagation(); setEditing(c); setForm({...c}); setShowModal(true); };

  const save = async () => {
    if (!form.entreprise.trim()) return;
    if (editing) await api.put(`/api/candidatures/${editing.id}`, form);
    else await api.post('/api/candidatures', form);
    showToast(editing ? '✅ Candidature modifiée !' : '✅ Candidature ajoutée !');
    setTimeout(() => setShowModal(false), 500);
    load();
  };

  const del = async (id, e) => {
    e.stopPropagation();
    if (window.confirm('Supprimer cette candidature ?')) {
      await api.delete(`/api/candidatures/${id}`); load();
      showToast('🗑️ Supprimée');
    }
  };

  const quickStatut = async (id, statut, e) => {
    e.stopPropagation();
    const c = list.find(x => x.id === id);
    await api.put(`/api/candidatures/${id}`, {...c, statut}); load();
    showToast(`📌 Statut : ${statut}`);
  };

  return (
    <div className="cand-page">
      <div className="cand-header">
        <h1 className="page-title">Candidatures <span className="count-badge">{filtered.length}</span></h1>
        <div className="cand-header-right">
          <div className="view-toggle">
            <button className={view==='list'?'view-btn active':'view-btn'} onClick={() => setView('list')}>☰ Liste</button>
            <button className={view==='kanban'?'view-btn active':'view-btn'} onClick={() => setView('kanban')}>⊞ Kanban</button>
          </div>
          <button className="btn-primary" onClick={openAdd}>+ Ajouter</button>
        </div>
      </div>

      <div className="filters">
        <input placeholder="🔍  Rechercher entreprise, poste, ville..." value={search} onChange={e => setSearch(e.target.value)} className="search-input" />
        <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)} className="filter-select">
          <option value="">Tous les statuts</option>
          {STATUTS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {view === 'list' ? (
        <div className="cand-list">
          {filtered.map(c => {
            const days = daysSince(c.date_candidature);
            const urgent = days !== null && days >= 7 && ['Postulé','En attente'].includes(c.statut);
            return (
              <div className={`cand-card ${urgent ? 'urgent' : ''}`} key={c.id} onClick={() => navigate('detail', c.id)}>
                <div className="cand-left">
                  <div className="cand-avatar">{c.entreprise[0]}</div>
                  <div>
                    <div className="cand-entreprise">
                      {c.entreprise}
                      {urgent && <span className="urgent-badge">Relance !</span>}
                    </div>
                    <div className="cand-poste">{c.poste}</div>
                    <div className="cand-meta">
                      {c.localisation && <span>📍 {c.localisation}</span>}
                      {c.source && <span>🔗 {c.source}</span>}
                      {c.date_candidature && <span>📅 {c.date_candidature}{days !== null ? ` (J+${days})` : ''}</span>}
                      {c.contact && <span>👤 {c.contact}</span>}
                    </div>
                  </div>
                </div>
                <div className="cand-right">
                  <select
                    className="statut-select"
                    value={c.statut}
                    style={{color: STATUT_COLORS[c.statut], borderColor: STATUT_COLORS[c.statut] + '33'}}
                    onClick={e => e.stopPropagation()}
                    onChange={e => quickStatut(c.id, e.target.value, e)}
                  >
                    {STATUTS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <div className="cand-actions">
                    <button className="icon-btn" onClick={e => openEdit(c, e)}>✏️</button>
                    <button className="icon-btn" onClick={e => del(c.id, e)}>🗑️</button>
                  </div>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && <div className="empty">Aucune candidature trouvée</div>}
        </div>
      ) : (
        <div className="kanban">
          {STATUTS.map(statut => {
            const cols = filtered.filter(c => c.statut === statut);
            return (
              <div className="kanban-col" key={statut}>
                <div className="kanban-col-header">
                  <span className="kanban-dot" style={{background: STATUT_COLORS[statut]}} />
                  <span className="kanban-col-title">{statut}</span>
                  <span className="kanban-count">{cols.length}</span>
                </div>
                <div className="kanban-cards">
                  {cols.map(c => (
                    <div className="kanban-card" key={c.id} onClick={() => navigate('detail', c.id)}>
                      <div className="kanban-avatar">{c.entreprise[0]}</div>
                      <div className="kanban-entreprise">{c.entreprise}</div>
                      <div className="kanban-poste">{c.poste}</div>
                      {c.localisation && <div className="kanban-loc">📍 {c.localisation}</div>}
                      {c.date_candidature && <div className="kanban-date">📅 {c.date_candidature}</div>}
                    </div>
                  ))}
                  {cols.length === 0 && <div className="kanban-empty">Aucune</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <Modal title={editing ? 'Modifier la candidature' : 'Nouvelle candidature'} onClose={() => setShowModal(false)} onSave={save}>
          <div className="form-grid">
            <div className="form-group full">
              <label>Entreprise *</label>
              <input value={form.entreprise} onChange={e => setForm({...form, entreprise:e.target.value})} placeholder="Ex: CAPGEMINI" />
            </div>
            <div className="form-group full">
              <label>Poste</label>
              <input value={form.poste} onChange={e => setForm({...form, poste:e.target.value})} placeholder="Ex: Alternant Administrateur IT" />
            </div>
            <div className="form-group">
              <label>Localisation</label>
              <input value={form.localisation||''} onChange={e => setForm({...form, localisation:e.target.value})} placeholder="Ex: Lyon, Paris..." />
            </div>
            <div className="form-group">
              <label>Source</label>
              <input value={form.source} onChange={e => setForm({...form, source:e.target.value})} placeholder="LinkedIn, HelloWork..." />
            </div>
            <div className="form-group">
              <label>Date</label>
              <input type="date" value={form.date_candidature} onChange={e => setForm({...form, date_candidature:e.target.value})} />
            </div>
            <div className="form-group">
              <label>Contact</label>
              <input value={form.contact} onChange={e => setForm({...form, contact:e.target.value})} placeholder="Nom du recruteur" />
            </div>
            <div className="form-group full">
              <label>Statut</label>
              <select value={form.statut} onChange={e => setForm({...form, statut:e.target.value})}>
                {STATUTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group full">
              <label>Notes</label>
              <textarea value={form.notes} onChange={e => setForm({...form, notes:e.target.value})} rows={3} placeholder="Infos utiles, impressions..." />
            </div>
          </div>
        </Modal>
      )}

      {toast && (
        <div className="toast">{toast}</div>
      )}
    </div>
  );
}
