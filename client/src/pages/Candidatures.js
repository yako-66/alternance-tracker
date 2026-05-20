import React, { useEffect, useState } from 'react';
import { api } from '../hooks/api';
import Modal from '../components/Modal';
import './Candidatures.css';

const STATUTS = ['Postulé','En attente','En attente de réponse','Entretien','Refus','Sans suite'];
const STATUT_COLORS = {
  'Postulé':'#4ecdc4','En attente':'#ff9f43','En attente de réponse':'#ffd93d',
  'Entretien':'#00d4a0','Refus':'#ff6b6b','Sans suite':'#6b6b80'
};

const empty = { entreprise:'', poste:'', source:'', date_candidature:'', contact:'', statut:'Postulé', notes:'' };

export default function Candidatures({ navigate }) {
  const [list, setList] = useState([]);
  const [search, setSearch] = useState('');
  const [filterStatut, setFilterStatut] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);

  const load = () => api.get('/api/candidatures').then(setList);
  useEffect(() => { load(); }, []);

  const filtered = list.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !q || c.entreprise.toLowerCase().includes(q) || c.poste?.toLowerCase().includes(q) || c.source?.toLowerCase().includes(q);
    const matchStatut = !filterStatut || c.statut === filterStatut;
    return matchSearch && matchStatut;
  });

  const openAdd = () => { setEditing(null); setForm(empty); setShowModal(true); };
  const openEdit = (c, e) => { e.stopPropagation(); setEditing(c); setForm({...c}); setShowModal(true); };

  const save = async () => {
    if (!form.entreprise.trim()) return;
    if (editing) await api.put(`/api/candidatures/${editing.id}`, form);
    else await api.post('/api/candidatures', form);
    setShowModal(false); load();
  };

  const del = async (id, e) => {
    e.stopPropagation();
    if (window.confirm('Supprimer cette candidature ?')) {
      await api.delete(`/api/candidatures/${id}`); load();
    }
  };

  const quickStatut = async (id, statut, e) => {
    e.stopPropagation();
    const c = list.find(x => x.id === id);
    await api.put(`/api/candidatures/${id}`, {...c, statut});
    load();
  };

  return (
    <div className="cand-page">
      <div className="cand-header">
        <h1 className="page-title">Candidatures <span className="count-badge">{filtered.length}</span></h1>
        <button className="btn-primary" onClick={openAdd}>+ Ajouter</button>
      </div>

      <div className="filters">
        <input placeholder="🔍  Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="search-input" />
        <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)} className="filter-select">
          <option value="">Tous les statuts</option>
          {STATUTS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="cand-list">
        {filtered.map(c => (
          <div className="cand-card" key={c.id} onClick={() => navigate('detail', c.id)}>
            <div className="cand-left">
              <div className="cand-avatar">{c.entreprise[0]}</div>
              <div>
                <div className="cand-entreprise">{c.entreprise}</div>
                <div className="cand-poste">{c.poste}</div>
                <div className="cand-meta">
                  {c.source && <span>📍 {c.source}</span>}
                  {c.date_candidature && <span>📅 {c.date_candidature}</span>}
                  {c.contact && <span>👤 {c.contact}</span>}
                </div>
              </div>
            </div>
            <div className="cand-right">
              <select
                className="statut-select"
                value={c.statut}
                style={{color: STATUT_COLORS[c.statut], borderColor: STATUT_COLORS[c.statut] + '44'}}
                onClick={e => e.stopPropagation()}
                onChange={e => quickStatut(c.id, e.target.value, e)}
              >
                {STATUTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <div className="cand-actions">
                <button className="icon-btn edit" onClick={e => openEdit(c, e)} title="Modifier">✏️</button>
                <button className="icon-btn del" onClick={e => del(c.id, e)} title="Supprimer">🗑️</button>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div className="empty">Aucune candidature trouvée</div>}
      </div>

      {showModal && (
        <Modal title={editing ? 'Modifier' : 'Nouvelle candidature'} onClose={() => setShowModal(false)} onSave={save}>
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
            <div className="form-group">
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
    </div>
  );
}
