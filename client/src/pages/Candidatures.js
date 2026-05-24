import React, { useEffect, useRef, useState, useCallback } from 'react';
import { api } from '../hooks/api';
import Modal from '../components/Modal';
import Confetti from '../components/Confetti';
import './Candidatures.css';

const geoCache = new Map();

function MiniMap({ localisation }) {
  const [url, setUrl] = useState(() => geoCache.get(localisation) || null);
  useEffect(() => {
    if (!localisation || geoCache.has(localisation)) {
      if (geoCache.has(localisation)) setUrl(geoCache.get(localisation));
      return;
    }
    fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(localisation)}&format=json&limit=1`)
      .then(r => r.json())
      .then(data => {
        if (data?.[0]) {
          const la = parseFloat(data[0].lat), lo = parseFloat(data[0].lon), z = 0.1;
          const built = `https://www.openstreetmap.org/export/embed.html?bbox=${lo-z},${la-z},${lo+z},${la+z}&layer=mapnik&marker=${la},${lo}`;
          geoCache.set(localisation, built); setUrl(built);
        } else { geoCache.set(localisation, ''); }
      }).catch(() => {});
  }, [localisation]);
  if (!url) return <div className="cand-map-loading">📍</div>;
  return (
    <div className="cand-map" onClick={e => e.stopPropagation()}>
      <iframe title={`Carte ${localisation}`} src={url} className="cand-map-iframe" loading="lazy" scrolling="no" tabIndex="-1" />
    </div>
  );
}

function StarDisplay({ score }) {
  return (
    <div className="star-display">
      {[1,2,3,4,5].map(i => <span key={i} style={{color: i <= score ? '#F59E0B' : '#D1C4E9'}}>★</span>)}
    </div>
  );
}

function StarEdit({ score, onChange }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="star-row">
      {[1,2,3,4,5].map(i => (
        <button
          key={i} type="button"
          className={`star-btn ${i <= (hovered || score) ? 'filled' : ''}`}
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(i === score ? 0 : i)}
          title={`${i} étoile${i > 1 ? 's' : ''}`}
        >★</button>
      ))}
      {score > 0 && <span style={{fontSize:'0.7rem',color:'var(--muted)',marginLeft:4}}>{score}/5</span>}
    </div>
  );
}

function SkeletonList() {
  return (
    <div className="cand-list">
      {[1,2,3,4,5].map(i => (
        <div className="skeleton-card" key={i} style={{animationDelay:`${i*60}ms`}}>
          <div className="skeleton skel-avatar" />
          <div className="skel-lines">
            <div className="skeleton skel-line skel-line-med" />
            <div className="skeleton skel-line skel-line-short" />
            <div className="skeleton skel-line skel-line-long" style={{height:'8px'}} />
          </div>
          <div className="skeleton skel-badge" />
        </div>
      ))}
    </div>
  );
}

const STATUTS = ['Postulé','En attente','En attente de réponse','Entretien','Refus','Sans suite'];
const STATUT_COLORS = {
  'Postulé':'#4ecdc4','En attente':'#ff9f43','En attente de réponse':'#ffd93d',
  'Entretien':'#00d4a0','Refus':'#ff6b6b','Sans suite':'#4a4a60'
};

const empty = { entreprise:'', poste:'', source:'', date_candidature:'', contact:'', statut:'Postulé', notes:'', localisation:'', priorite:0, score:0, date_entretien:'' };

function daysSince(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.includes('/') ? dateStr.split('/').reverse() : dateStr.split('-');
  const d = new Date(parts.join('-'));
  if (isNaN(d)) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

export default function Candidatures({ navigate }) {
  const [list, setList]               = useState([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [filterStatut, setFilterStatut] = useState('');
  const [filterPrio, setFilterPrio]   = useState(false);
  const [view, setView]               = useState('list');
  const [showModal, setShowModal]     = useState(false);
  const [editing, setEditing]         = useState(null);
  const [form, setForm]               = useState(empty);
  const [toast, setToast]             = useState('');
  const [saving, setSaving]           = useState(false);
  const [savedOk, setSavedOk]         = useState(false);
  const [savedMsg, setSavedMsg]       = useState('');
  const [sortKey, setSortKey]         = useState('recent');
  const [confetti, setConfetti]       = useState(false);
  const [draggedId, setDraggedId]     = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);
  const searchRef = useRef(null);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/api/candidatures').then(data => { setList(data); setLoading(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  // Raccourcis clavier
  useEffect(() => {
    const handler = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (showModal) return;
      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); openAdd(); }
      if (e.key === '/') { e.preventDefault(); searchRef.current?.focus(); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [showModal]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3200); };

  const filtered = list.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !q || c.entreprise?.toLowerCase().includes(q) || c.poste?.toLowerCase().includes(q) || c.source?.toLowerCase().includes(q) || c.localisation?.toLowerCase().includes(q);
    const matchStatut = !filterStatut || c.statut === filterStatut;
    const matchPrio = !filterPrio || c.priorite === 1;
    return matchSearch && matchStatut && matchPrio;
  });

  const STATUT_ORDER = ['Entretien','En attente de réponse','En attente','Postulé','Sans suite','Refus'];
  const sorted = [...filtered].sort((a, b) => {
    switch (sortKey) {
      case 'az':     return (a.entreprise||'').localeCompare(b.entreprise||'');
      case 'za':     return (b.entreprise||'').localeCompare(a.entreprise||'');
      case 'oldest': return (a.date_candidature||'').localeCompare(b.date_candidature||'');
      case 'newest': return (b.date_candidature||'').localeCompare(a.date_candidature||'');
      case 'statut': return STATUT_ORDER.indexOf(a.statut) - STATUT_ORDER.indexOf(b.statut);
      case 'score':  return (b.score||0) - (a.score||0);
      default:       return b.id - a.id;
    }
  });

  const exportCSV = () => {
    const headers = ['Entreprise','Poste','Statut','Localisation','Source','Date','Contact','Notes','Score','Prioritaire'];
    const rows = sorted.map(c => [
      c.entreprise, c.poste, c.statut, c.localisation, c.source,
      c.date_candidature, c.contact, (c.notes||'').replace(/\n/g,' '), c.score||0, c.priorite?'Oui':'Non',
    ].map(v => `"${(v??'').toString().replace(/"/g,'""')}"`));
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['﻿' + csv], { type:'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `candidatures-${new Date().toISOString().split('T')[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
    showToast('📥 Export CSV téléchargé !');
  };

  const openAdd = () => { setEditing(null); setForm({...empty, date_candidature: new Date().toISOString().split('T')[0]}); setShowModal(true); };
  const openEdit = (c, e) => { e.stopPropagation(); setEditing(c); setForm({...c, priorite:c.priorite||0, score:c.score||0}); setShowModal(true); };

  const save = async () => {
    if (!form.entreprise.trim()) return;
    setSaving(true);
    try {
      const prevStatut = editing?.statut;
      if (editing) await api.put(`/api/candidatures/${editing.id}`, form);
      else await api.post('/api/candidatures', form);
      setSaving(false);
      const msg = editing ? `${form.entreprise} modifiée !` : `${form.entreprise} ajoutée ! 🎉`;
      setSavedMsg(msg);
      setSavedOk(true);
      if (form.statut === 'Entretien' && prevStatut !== 'Entretien') setConfetti(true);
      setTimeout(() => {
        setShowModal(false);
        setSavedOk(false);
        setSavedMsg('');
        load();
        showToast(editing ? `✅ Candidature modifiée !` : `✅ ${form.entreprise} ajoutée !`);
      }, 2400);
    } catch { setSaving(false); }
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
    const prev = c?.statut;
    await api.put(`/api/candidatures/${id}`, {...c, statut}); load();
    showToast(`📌 Statut : ${statut}`);
    if (statut === 'Entretien' && prev !== 'Entretien') setConfetti(true);
  };

  const togglePriorite = async (c, e) => {
    e.stopPropagation();
    const newPrio = c.priorite === 1 ? 0 : 1;
    await api.put(`/api/candidatures/${c.id}`, {...c, priorite: newPrio}); load();
    showToast(newPrio === 1 ? `🔥 ${c.entreprise} prioritaire !` : `⬇️ Priorité retirée`);
  };

  const quickRelance = async (c, e) => {
    e.stopPropagation();
    await api.post(`/api/candidatures/${c.id}/echanges`, {
      type: 'Relance', contenu: 'Relance effectuée',
      date: new Date().toISOString().split('T')[0],
    });
    if (['Postulé','En attente'].includes(c.statut)) {
      await api.put(`/api/candidatures/${c.id}`, {...c, statut: 'En attente de réponse'}); load();
    }
    showToast(`📨 Relance — ${c.entreprise}`);
  };

  const quickScore = async (c, score, e) => {
    e.stopPropagation();
    await api.put(`/api/candidatures/${c.id}`, {...c, score}); load();
  };

  // Kanban drag & drop
  const onDragStart = (e, id) => { setDraggedId(id); e.dataTransfer.effectAllowed = 'move'; };
  const onDragOver = (e, statut) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverCol(statut); };
  const onDragLeave = () => setDragOverCol(null);
  const onDrop = async (e, statut) => {
    e.preventDefault(); setDragOverCol(null);
    if (!draggedId) return;
    const c = list.find(x => x.id === draggedId);
    if (c && c.statut !== statut) {
      await api.put(`/api/candidatures/${draggedId}`, {...c, statut}); load();
      showToast(`📌 Déplacé → ${statut}`);
      if (statut === 'Entretien') setConfetti(true);
    }
    setDraggedId(null);
  };

  return (
    <div className="cand-page">
      <Confetti active={confetti} onDone={() => setConfetti(false)} />

      <div className="cand-header">
        <h1 className="page-title">
          Candidatures <span className="count-badge">{filtered.length}</span>
        </h1>
        <div className="cand-header-right">
          <div className="view-toggle">
            <button className={view==='list'?'view-btn active':'view-btn'} onClick={() => setView('list')}>☰ Liste</button>
            <button className={view==='kanban'?'view-btn active':'view-btn'} onClick={() => setView('kanban')}>⊞ Kanban</button>
          </div>
          <button className="btn-export" onClick={exportCSV} title="Exporter en CSV">⬇ CSV</button>
          <button className="btn-primary" onClick={openAdd} title="Nouvelle candidature (N)">+ Ajouter</button>
        </div>
      </div>

      <div className="filters">
        <input
          ref={searchRef}
          placeholder="🔍  Rechercher… (appuie sur /)"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="search-input"
        />
        <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)} className="filter-select">
          <option value="">Tous les statuts</option>
          {STATUTS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={sortKey} onChange={e => setSortKey(e.target.value)} className="filter-select sort-select">
          <option value="recent">↕ Plus récent</option>
          <option value="oldest">↕ Plus ancien</option>
          <option value="newest">↕ Date récente</option>
          <option value="az">↕ A → Z</option>
          <option value="za">↕ Z → A</option>
          <option value="statut">↕ Par statut</option>
          <option value="score">↕ Meilleur score</option>
        </select>
        <button className={`btn-prio-filter ${filterPrio ? 'active' : ''}`} onClick={() => setFilterPrio(p => !p)}>
          🔥 Prioritaires
        </button>
        {(search || filterStatut) && (
          <button className="btn-reset-filters" onClick={() => { setSearch(''); setFilterStatut(''); }}>✕ Effacer</button>
        )}
      </div>

      {loading ? <SkeletonList /> : view === 'list' ? (
        <div className="cand-list">
          {sorted.map((c, i) => {
            const days = daysSince(c.date_candidature);
            const urgent = days !== null && days >= 7 && ['Postulé','En attente'].includes(c.statut);
            return (
              <div
                className={`cand-card ${urgent ? 'urgent' : ''} ${c.priorite ? 'prioritaire' : ''}`}
                key={c.id}
                style={{animationDelay:`${i * 35}ms`}}
                onClick={() => navigate('detail', c.id)}
              >
                <div className="cand-left">
                  <div className="cand-avatar">{(c.entreprise||'?')[0]}</div>
                  <div>
                    <div className="cand-entreprise">
                      {c.entreprise}
                      {c.priorite === 1 && <span className="prio-badge">🔥</span>}
                      {urgent && <span className="urgent-badge">Relance !</span>}
                    </div>
                    <div className="cand-poste">{c.poste}</div>
                    <div className="cand-meta">
                      {c.localisation && <span>📍 {c.localisation}</span>}
                      {c.source && <span>🔗 {c.source}</span>}
                      {c.date_candidature && <span>📅 {c.date_candidature}{days !== null ? ` (J+${days})` : ''}</span>}
                      {c.contact && <span>👤 {c.contact}</span>}
                    </div>
                    {c.score > 0 && (
                      <div style={{marginTop:4}}>
                        <StarDisplay score={c.score} />
                      </div>
                    )}
                  </div>
                </div>
                {c.localisation && <MiniMap localisation={c.localisation} />}
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
                  <div className="cand-score-row" onClick={e => e.stopPropagation()}>
                    {[1,2,3,4,5].map(s => (
                      <button key={s} className={`star-btn ${s <= (c.score||0) ? 'filled' : ''}`}
                        onClick={e => quickScore(c, s === c.score ? 0 : s, e)} title={`${s}★`}>★</button>
                    ))}
                  </div>
                  <div className="cand-actions">
                    <button className="icon-btn" title="Relance rapide" onClick={e => quickRelance(c, e)}>📨</button>
                    <button className={`icon-btn ${c.priorite ? 'icon-btn-active' : ''}`} title={c.priorite ? 'Retirer priorité' : 'Prioritaire'} onClick={e => togglePriorite(c, e)}>🔥</button>
                    <button className="icon-btn" onClick={e => openEdit(c, e)}>✏️</button>
                    <button className="icon-btn" onClick={e => del(c.id, e)}>🗑️</button>
                  </div>
                </div>
              </div>
            );
          })}
          {sorted.length === 0 && (
            <div className="empty">
              <div style={{fontSize:'2.5rem',marginBottom:12}}>🔍</div>
              <div>Aucune candidature trouvée</div>
              {(search || filterStatut) && <div style={{fontSize:'0.8rem',marginTop:6,color:'var(--muted)'}}>Essaie d'effacer tes filtres</div>}
            </div>
          )}
        </div>
      ) : (
        <div className="kanban">
          {STATUTS.map(statut => {
            const cols = sorted.filter(c => c.statut === statut);
            return (
              <div
                key={statut}
                className={`kanban-col ${dragOverCol === statut ? 'drag-over' : ''}`}
                onDragOver={e => onDragOver(e, statut)}
                onDragLeave={onDragLeave}
                onDrop={e => onDrop(e, statut)}
              >
                <div className="kanban-col-header">
                  <span className="kanban-dot" style={{background: STATUT_COLORS[statut]}} />
                  <span className="kanban-col-title">{statut}</span>
                  <span className="kanban-count">{cols.length}</span>
                </div>
                <div className="kanban-cards">
                  {cols.map(c => (
                    <div
                      className={`kanban-card ${c.priorite ? 'kanban-card-prio' : ''} ${draggedId === c.id ? 'dragging' : ''}`}
                      key={c.id}
                      draggable
                      onDragStart={e => onDragStart(e, c.id)}
                      onDragEnd={() => setDraggedId(null)}
                      onClick={() => navigate('detail', c.id)}
                    >
                      <div className="kanban-card-top">
                        <div className="kanban-avatar">{(c.entreprise||'?')[0]}</div>
                        {c.priorite === 1 && <span className="kanban-prio-badge">🔥</span>}
                      </div>
                      <div className="kanban-entreprise">{c.entreprise}</div>
                      <div className="kanban-poste">{c.poste}</div>
                      {c.localisation && <div className="kanban-loc">📍 {c.localisation}</div>}
                      {c.date_candidature && <div className="kanban-date">📅 {c.date_candidature}</div>}
                      {c.score > 0 && <StarDisplay score={c.score} />}
                    </div>
                  ))}
                  {cols.length === 0 && <div className="kanban-empty">Glisse ici</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <Modal
          title={editing ? 'Modifier la candidature' : 'Nouvelle candidature'}
          onClose={() => { if (!savedOk) { setShowModal(false); setSaving(false); } }}
          onSave={save} saving={saving} savedOk={savedOk} savedMsg={savedMsg}
        >
          <div className="form-grid">
            <div className="form-group full">
              <label>Entreprise *</label>
              <input value={form.entreprise} onChange={e => setForm({...form, entreprise:e.target.value})} placeholder="Ex: CAPGEMINI" autoFocus />
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
              <label>Date de candidature</label>
              <input type="date" value={form.date_candidature} onChange={e => setForm({...form, date_candidature:e.target.value})} />
            </div>
            <div className="form-group">
              <label>Date d'entretien</label>
              <input type="date" value={form.date_entretien||''} onChange={e => setForm({...form, date_entretien:e.target.value})} />
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
            <div className="form-group">
              <label>Intérêt pour ce poste</label>
              <div style={{paddingTop:6}}>
                <StarEdit score={form.score||0} onChange={s => setForm({...form, score:s})} />
              </div>
            </div>
            <div className="form-group">
              <label>&nbsp;</label>
              <button
                type="button"
                className={`prio-toggle ${form.priorite ? 'prio-toggle-on' : ''}`}
                onClick={() => setForm({...form, priorite: form.priorite ? 0 : 1})}
              >
                🔥 {form.priorite ? 'Prioritaire ✓' : 'Marquer prioritaire'}
              </button>
            </div>
            <div className="form-group full">
              <label>Notes</label>
              <textarea value={form.notes} onChange={e => setForm({...form, notes:e.target.value})} rows={3} placeholder="Infos utiles, impressions..." />
            </div>
          </div>
        </Modal>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
