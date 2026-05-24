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

function CompletionBar({ c }) {
  const fields = [c.entreprise, c.poste, c.source, c.contact, c.localisation, c.notes, c.date_candidature, c.date_entretien, c.score > 0 ? 'yes' : ''];
  const score = Math.round(fields.filter(Boolean).length / fields.length * 100);
  const color = score >= 78 ? '#10B981' : score >= 45 ? '#F59E0B' : '#EF4444';
  return (
    <div className="completion-bar-wrap" title={`Complétude : ${score}%`}>
      <div className="completion-bar-fill" style={{ width: `${score}%`, background: color }} />
    </div>
  );
}

function TagPills({ tags }) {
  if (!tags) return null;
  const list = tags.split(',').map(t => t.trim()).filter(Boolean);
  if (!list.length) return null;
  return (
    <div className="tag-pills">
      {list.map(t => <span key={t} className="tag-pill">{t}</span>)}
    </div>
  );
}

const STATUTS = ['Postulé','En attente','En attente de réponse','Entretien','Refus','Sans suite'];
const STATUT_COLORS = {
  'Postulé':'#4ecdc4','En attente':'#ff9f43','En attente de réponse':'#ffd93d',
  'Entretien':'#00d4a0','Refus':'#ff6b6b','Sans suite':'#4a4a60'
};
const FOCUS_EXCLUDE = ['Refus','Sans suite'];

const SECTEURS = ['','Informatique / IT','Cloud / Infra','Cybersécurité','Développement','Data / IA','Finance / Banque','Assurance','Industrie','Énergie','Santé','Commerce / Distribution','Conseil','Télécom','Transport / Logistique','Autre'];
const TAILLES = ['','< 10 salariés','10-50 salariés','50-250 salariés','250-1000 salariés','> 1000 salariés'];

const empty = { entreprise:'', poste:'', source:'', date_candidature:'', contact:'', statut:'Postulé', notes:'', localisation:'', priorite:0, score:0, date_entretien:'', archived:0, tags:'', salaire:'', secteur:'', taille:'', date_rappel:'' };

function daysSince(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.includes('/') ? dateStr.split('/').reverse() : dateStr.split('-');
  const d = new Date(parts.join('-'));
  if (isNaN(d)) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

const TABLE_COLS = [
  { key:'entreprise',      label:'Entreprise', w:'22%' },
  { key:'poste',           label:'Poste',      w:'20%' },
  { key:'statut',          label:'Statut',     w:'14%' },
  { key:'localisation',    label:'Lieu',       w:'12%' },
  { key:'date_candidature',label:'Date',       w:'10%' },
  { key:'days',            label:'J+',         w:'6%'  },
  { key:'score',           label:'Score',      w:'8%'  },
];

export default function Candidatures({ navigate }) {
  const [list, setList]                 = useState([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');
  const [filterStatut, setFilterStatut] = useState('');
  const [filterPrio, setFilterPrio]     = useState(false);
  const [filterFocus, setFilterFocus]   = useState(false);
  const [filterArchived, setFilterArchived] = useState(false);
  const [filterTag, setFilterTag]       = useState('');
  const [view, setView]                 = useState('list');
  const [showModal, setShowModal]       = useState(false);
  const [editing, setEditing]           = useState(null);
  const [form, setForm]                 = useState(empty);
  const [toast, setToast]               = useState('');
  const [saving, setSaving]             = useState(false);
  const [savedOk, setSavedOk]           = useState(false);
  const [savedMsg, setSavedMsg]         = useState('');
  const [sortKey, setSortKey]           = useState('recent');
  const [tableSortKey, setTableSortKey] = useState('recent');
  const [tableSortDir, setTableSortDir] = useState('desc');
  const [confetti, setConfetti]         = useState(false);
  const [draggedId, setDraggedId]       = useState(null);
  const [dragOverCol, setDragOverCol]   = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [selectMode, setSelectMode]     = useState(false);
  const [selectedIds, setSelectedIds]   = useState(new Set());
  const searchRef = useRef(null);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/api/candidatures').then(data => { setList(data); setLoading(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

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

  // All unique tags across candidatures
  const allTags = [...new Set(
    list.flatMap(c => (c.tags||'').split(',').map(t => t.trim()).filter(Boolean))
  )].sort();

  const filtered = list.filter(c => {
    if (!filterArchived && c.archived) return false;
    if (filterArchived && !c.archived) return false;
    const q = search.toLowerCase();
    const matchSearch = !q || c.entreprise?.toLowerCase().includes(q) || c.poste?.toLowerCase().includes(q) || c.source?.toLowerCase().includes(q) || c.localisation?.toLowerCase().includes(q) || c.notes?.toLowerCase().includes(q) || c.contact?.toLowerCase().includes(q) || c.tags?.toLowerCase().includes(q);
    const matchStatut = !filterStatut || c.statut === filterStatut;
    const matchPrio = !filterPrio || c.priorite === 1;
    const matchFocus = !filterFocus || !FOCUS_EXCLUDE.includes(c.statut);
    const matchTag = !filterTag || (c.tags||'').split(',').map(t=>t.trim()).includes(filterTag);
    return matchSearch && matchStatut && matchPrio && matchFocus && matchTag;
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

  const tableSorted = [...filtered].sort((a, b) => {
    let va, vb;
    if (tableSortKey === 'days') { va = daysSince(a.date_candidature) ?? 9999; vb = daysSince(b.date_candidature) ?? 9999; }
    else if (tableSortKey === 'score') { va = a.score || 0; vb = b.score || 0; }
    else if (tableSortKey === 'statut') { va = STATUT_ORDER.indexOf(a.statut); vb = STATUT_ORDER.indexOf(b.statut); }
    else if (tableSortKey === 'recent') { va = a.id; vb = b.id; }
    else { va = (a[tableSortKey] || '').toString().toLowerCase(); vb = (b[tableSortKey] || '').toString().toLowerCase(); }
    return tableSortDir === 'asc' ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
  });

  const handleTableSort = (key) => {
    if (tableSortKey === key) setTableSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setTableSortKey(key); setTableSortDir('asc'); }
  };

  const exportPDF = () => {
    const total = sorted.length;
    const entretiens = sorted.filter(c => c.statut === 'Entretien').length;
    const tauxReponse = total > 0
      ? Math.round((sorted.filter(c => c.statut !== 'Postulé').length / total) * 100)
      : 0;
    const prioritaires = sorted.filter(c => c.priorite).length;
    const rows = sorted.map(c => {
      const days = daysSince(c.date_candidature);
      const col = STATUT_COLORS[c.statut] || '#9a9aa8';
      return `<tr>
        <td><strong>${c.entreprise || '—'}</strong>${c.priorite ? ' 🔥' : ''}</td>
        <td>${c.poste || '—'}</td>
        <td><span class="badge" style="background:${col}22;color:${col};border:1px solid ${col}44">${c.statut}</span></td>
        <td>${c.localisation || '—'}</td>
        <td>${c.date_candidature || '—'}</td>
        <td>${days !== null ? 'J+' + days : '—'}</td>
        <td>${c.score > 0 ? '★'.repeat(c.score) : '—'}</td>
      </tr>`;
    }).join('');
    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
<title>Rapport — ${new Date().toLocaleDateString('fr-FR')}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',system-ui,sans-serif;background:#fff;color:#1a1a2e;padding:40px;font-size:13px}
h1{font-size:1.8rem;font-weight:800;color:#7c3aed;margin-bottom:4px}
.sub{color:#888;font-size:0.85rem;margin-bottom:28px}
.kpis{display:flex;gap:16px;margin-bottom:28px;flex-wrap:wrap}
.kpi{background:#f5f3ff;border-radius:12px;padding:14px 22px;text-align:center;flex:1;min-width:110px;border:1px solid #e9d5ff}
.kpi-num{font-size:1.8rem;font-weight:800;color:#7c3aed}
.kpi-label{font-size:0.75rem;color:#666;margin-top:2px;text-transform:uppercase;letter-spacing:0.04em}
h2{font-size:1rem;font-weight:700;margin-bottom:10px;border-bottom:2px solid #f5f3ff;padding-bottom:5px;color:#4c1d95}
table{width:100%;border-collapse:collapse}
th{background:#7c3aed;color:#fff;padding:8px 10px;text-align:left;font-size:0.78rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em}
td{padding:7px 10px;border-bottom:1px solid #f0eeff;vertical-align:middle}
tr:nth-child(even) td{background:#faf8ff}
.badge{display:inline-block;padding:2px 7px;border-radius:5px;font-size:0.73rem;font-weight:600;white-space:nowrap}
.footer{text-align:center;color:#bbb;font-size:0.75rem;margin-top:36px;padding-top:16px;border-top:1px solid #f0eeff}
@media print{body{padding:20px}button{display:none}}
</style></head><body>
<h1>📋 Rapport de candidatures</h1>
<div class="sub">Généré le ${new Date().toLocaleDateString('fr-FR',{weekday:'long',year:'numeric',month:'long',day:'numeric'})} · AlternanceTracker</div>
<div class="kpis">
  <div class="kpi"><div class="kpi-num">${total}</div><div class="kpi-label">Total</div></div>
  <div class="kpi"><div class="kpi-num">${entretiens}</div><div class="kpi-label">Entretiens</div></div>
  <div class="kpi"><div class="kpi-num">${tauxReponse}%</div><div class="kpi-label">Taux retour</div></div>
  <div class="kpi"><div class="kpi-num">${prioritaires}</div><div class="kpi-label">Prioritaires</div></div>
</div>
<h2>Liste des candidatures (${total})</h2>
<table><thead><tr><th>Entreprise</th><th>Poste</th><th>Statut</th><th>Lieu</th><th>Date</th><th>J+</th><th>Note</th></tr></thead>
<tbody>${rows}</tbody></table>
<div class="footer">AlternanceTracker · ${new Date().getFullYear()}</div>
<script>window.onload=()=>{window.print();}<\/script>
</body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const blobUrl = URL.createObjectURL(blob);
    const win = window.open(blobUrl, '_blank');
    setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
    if (!win) showToast('❌ Autorise les popups pour exporter en PDF');
    else showToast('📄 Rapport ouvert — Ctrl+P pour enregistrer en PDF');
  };

  const exportCSV = () => {
    const headers = ['Entreprise','Poste','Statut','Localisation','Source','Date','Contact','Notes','Score','Prioritaire','Tags'];
    const rows = sorted.map(c => [
      c.entreprise, c.poste, c.statut, c.localisation, c.source,
      c.date_candidature, c.contact, (c.notes||'').replace(/\n/g,' '), c.score||0, c.priorite?'Oui':'Non', c.tags||'',
    ].map(v => `"${(v??'').toString().replace(/"/g,'""')}"`));
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['﻿' + csv], { type:'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `candidatures-${new Date().toISOString().split('T')[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
    showToast('📥 Export CSV téléchargé !');
  };

  const [doublonWarning, setDoublonWarning] = useState('');
  const [showParse, setShowParse] = useState(false);
  const [parseText, setParseText] = useState('');
  const [parsePending, setParsePending] = useState(false);
  const [parseMode, setParseMode] = useState('text');
  const [parseUrl, setParseUrl] = useState('');

  const applyParsed = (res) => {
    setForm(f => ({...f,
      entreprise: res.entreprise || f.entreprise,
      poste: res.poste || f.poste,
      localisation: res.localisation || f.localisation,
      source: res.source || f.source,
      salaire: res.salaire || f.salaire,
      secteur: res.secteur || f.secteur,
      notes: res.notes ? (f.notes ? f.notes + '\n' + res.notes : res.notes) : f.notes,
    }));
    setShowParse(false);
  };

  const runParse = async () => {
    if (!parseText.trim()) return;
    setParsePending(true);
    try {
      const res = await api.post('/api/ai/parse', { text: parseText });
      applyParsed(res);
      setParseText('');
      showToast('✨ Offre parsée ! Vérifie les champs.');
    } catch(e) { showToast('❌ Erreur parsing : ' + (e.message || 'API indisponible')); }
    setParsePending(false);
  };

  const runParseUrl = async () => {
    if (!parseUrl.trim()) return;
    setParsePending(true);
    try {
      const res = await api.post('/api/ai/import-url', { url: parseUrl });
      applyParsed(res);
      setParseUrl('');
      showToast('✨ Offre importée ! Vérifie les champs.');
    } catch(e) { showToast('❌ Import impossible : ' + (e.message || 'Site inaccessible')); }
    setParsePending(false);
  };

  const checkDoublon = (nom) => {
    if (!nom.trim()) { setDoublonWarning(''); return; }
    const q = nom.trim().toLowerCase();
    const found = list.find(c => c.entreprise?.toLowerCase() === q && (!editing || c.id !== editing.id));
    setDoublonWarning(found ? `⚠️ "${found.entreprise}" existe déjà (${found.statut})` : '');
  };

  const openAdd = () => { setEditing(null); setDoublonWarning(''); setForm({...empty, date_candidature: new Date().toISOString().split('T')[0]}); setShowModal(true); };
  const openEdit = (c, e) => { e.stopPropagation(); setEditing(c); setDoublonWarning(''); setForm({...c, priorite:c.priorite||0, score:c.score||0, tags:c.tags||'', archived:c.archived||0, salaire:c.salaire||'', secteur:c.secteur||'', taille:c.taille||'', date_rappel:c.date_rappel||''}); setShowModal(true); };
  const duplicate = (c, e) => {
    e.stopPropagation();
    setEditing(null);
    setForm({...empty, ...c, id:undefined, date_candidature:new Date().toISOString().split('T')[0]});
    setShowModal(true);
    showToast('📋 Duplication — modifie et sauvegarde');
  };

  const save = async () => {
    if (!form.entreprise.trim()) return;
    setSaving(true);
    try {
      const prevStatut = editing?.statut;
      if (editing) await api.put(`/api/candidatures/${editing.id}`, form);
      else await api.post('/api/candidatures', form);
      setSaving(false);
      const msg = editing ? `${form.entreprise} modifiée !` : `${form.entreprise} ajoutée ! 🎉`;
      setSavedMsg(msg); setSavedOk(true);
      if (form.statut === 'Entretien' && prevStatut !== 'Entretien') setConfetti(true);
      setTimeout(() => {
        setShowModal(false); setSavedOk(false); setSavedMsg('');
        load();
        showToast(editing ? `✅ Candidature modifiée !` : `✅ ${form.entreprise} ajoutée !`);
      }, 2400);
    } catch { setSaving(false); }
  };

  // Undo delete — optimistic remove, real delete after 5s
  const del = (id, e) => {
    e.stopPropagation();
    if (pendingDelete) {
      clearTimeout(pendingDelete.timeoutId);
      api.delete(`/api/candidatures/${pendingDelete.id}`);
    }
    const cand = list.find(x => x.id === id);
    setList(prev => prev.filter(x => x.id !== id));
    const timeoutId = setTimeout(async () => {
      await api.delete(`/api/candidatures/${id}`);
      setPendingDelete(null);
    }, 5000);
    setPendingDelete({ id, cand, timeoutId });
  };

  const cancelDelete = () => {
    if (!pendingDelete) return;
    clearTimeout(pendingDelete.timeoutId);
    setList(prev => [pendingDelete.cand, ...prev].sort((a,b) => b.id - a.id));
    setPendingDelete(null);
  };

  const toggleArchive = async (c, e) => {
    e.stopPropagation();
    await api.put(`/api/candidatures/${c.id}`, {...c, archived: c.archived ? 0 : 1});
    load();
    showToast(c.archived ? `📤 ${c.entreprise} désarchivée` : `📦 ${c.entreprise} archivée`);
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

  // Multi-select
  const toggleSelect = (id, e) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const selectAll = () => setSelectedIds(new Set(sorted.map(c => c.id)));
  const clearSelect = () => { setSelectedIds(new Set()); setSelectMode(false); };

  const bulkArchive = async () => {
    const count = selectedIds.size;
    for (const id of selectedIds) {
      const c = list.find(x => x.id === id);
      if (c) await api.put(`/api/candidatures/${id}`, {...c, archived: 1});
    }
    clearSelect();
    load();
    showToast(`📦 ${count} candidature(s) archivée(s)`);
  };

  const bulkDelete = async () => {
    const count = selectedIds.size;
    if (!window.confirm(`Supprimer ${count} candidature(s) ? Cette action est irréversible.`)) return;
    for (const id of selectedIds) await api.delete(`/api/candidatures/${id}`);
    clearSelect();
    load();
    showToast(`🗑️ ${count} candidature(s) supprimée(s)`);
  };

  const bulkStatut = async (statut) => {
    for (const id of selectedIds) {
      const c = list.find(x => x.id === id);
      if (c) await api.put(`/api/candidatures/${id}`, {...c, statut});
    }
    clearSelect();
    load();
    showToast(`📌 Statut mis à jour pour ${selectedIds.size} candidature(s)`);
  };

  // Drag & drop kanban
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

  const activeFilters = (search || filterStatut || filterPrio || filterFocus || filterTag);

  return (
    <div className="cand-page">
      <Confetti active={confetti} onDone={() => setConfetti(false)} />

      <div className="cand-header">
        <h1 className="page-title">
          {filterArchived ? '📦 Archives' : 'Candidatures'} <span className="count-badge">{filtered.length}</span>
        </h1>
        <div className="cand-header-right">
          <div className="view-toggle">
            <button className={view==='list'?'view-btn active':'view-btn'} onClick={() => setView('list')}>☰ Liste</button>
            <button className={view==='kanban'?'view-btn active':'view-btn'} onClick={() => setView('kanban')}>⊞ Kanban</button>
            <button className={view==='table'?'view-btn active':'view-btn'} onClick={() => setView('table')}>⊟ Tableau</button>
          </div>
          <button className={`btn-select-mode ${selectMode ? 'active' : ''}`} onClick={() => { setSelectMode(s => !s); setSelectedIds(new Set()); }} title="Sélection multiple">
            ☑ Sélect.
          </button>
          <button className="btn-export" onClick={exportPDF} title="Exporter en PDF">📄 PDF</button>
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
        {allTags.length > 0 && (
          <select value={filterTag} onChange={e => setFilterTag(e.target.value)} className="filter-select">
            <option value="">Tous les tags</option>
            {allTags.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
        {view !== 'table' && (
          <select value={sortKey} onChange={e => setSortKey(e.target.value)} className="filter-select sort-select">
            <option value="recent">↕ Plus récent</option>
            <option value="oldest">↕ Plus ancien</option>
            <option value="newest">↕ Date récente</option>
            <option value="az">↕ A → Z</option>
            <option value="za">↕ Z → A</option>
            <option value="statut">↕ Par statut</option>
            <option value="score">↕ Meilleur score</option>
          </select>
        )}
        <button className={`btn-prio-filter ${filterPrio ? 'active' : ''}`} onClick={() => setFilterPrio(p => !p)}>
          🔥 Prioritaires
        </button>
        <button className={`btn-prio-filter ${filterFocus ? 'active' : ''}`} onClick={() => setFilterFocus(f => !f)} title="Masquer Refus et Sans suite">
          🎯 Focus
        </button>
        <button className={`btn-prio-filter ${filterArchived ? 'active' : ''}`} onClick={() => setFilterArchived(a => !a)} title="Voir les candidatures archivées">
          📦 Archives
        </button>
        {activeFilters && (
          <button className="btn-reset-filters" onClick={() => { setSearch(''); setFilterStatut(''); setFilterPrio(false); setFilterFocus(false); setFilterTag(''); }}>✕ Effacer</button>
        )}
      </div>

      {/* Barre d'actions en mode sélection */}
      {selectMode && (
        <div className="bulk-bar">
          <span className="bulk-count">{selectedIds.size} sélectionné(s)</span>
          <button className="bulk-btn" onClick={selectAll}>Tout sélectionner</button>
          {selectedIds.size > 0 && <>
            <button className="bulk-btn bulk-btn-archive" onClick={bulkArchive}>📦 Archiver</button>
            <select className="bulk-select" onChange={e => { if (e.target.value) bulkStatut(e.target.value); e.target.value=''; }}>
              <option value="">📌 Changer statut…</option>
              {STATUTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button className="bulk-btn bulk-btn-danger" onClick={bulkDelete}>🗑️ Supprimer</button>
          </>}
          <button className="bulk-btn-cancel" onClick={clearSelect}>✕ Annuler</button>
        </div>
      )}

      {loading ? <SkeletonList /> : view === 'table' ? (
        <div className="cand-table-wrap">
          <table className="cand-table">
            <thead>
              <tr>
                {selectMode && <th className="table-th th-check"><input type="checkbox" onChange={e => e.target.checked ? selectAll() : setSelectedIds(new Set())} /></th>}
                {TABLE_COLS.map(col => (
                  <th key={col.key} style={{width:col.w}} onClick={() => handleTableSort(col.key)} className={`table-th ${tableSortKey===col.key?'th-active':''}`}>
                    {col.label}
                    {tableSortKey===col.key && <span className="th-sort">{tableSortDir==='asc'?'↑':'↓'}</span>}
                  </th>
                ))}
                <th className="table-th" style={{width:'8%'}}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tableSorted.map((c, i) => {
                const days = daysSince(c.date_candidature);
                const urgent = days !== null && days >= 7 && ['Postulé','En attente'].includes(c.statut);
                const isSelected = selectedIds.has(c.id);
                return (
                  <tr key={c.id}
                    className={`table-row ${urgent?'table-row-urgent':''} ${c.priorite?'table-row-prio':''} ${isSelected?'table-row-selected':''}`}
                    onClick={() => selectMode ? toggleSelect(c.id, {stopPropagation:()=>{}}) : navigate('detail', c.id)}
                    style={{animationDelay:`${i*20}ms`}}
                  >
                    {selectMode && <td onClick={e=>e.stopPropagation()}><input type="checkbox" checked={isSelected} onChange={e => toggleSelect(c.id, e)} /></td>}
                    <td className="td-entreprise">
                      <div className="td-ent-inner">
                        <div className="td-avatar">{(c.entreprise||'?')[0]}</div>
                        <span className="td-ent-name">{c.entreprise}{c.priorite?<span className="td-prio-dot">🔥</span>:null}</span>
                      </div>
                    </td>
                    <td className="td-text td-muted">{c.poste||'—'}</td>
                    <td>
                      <span className="td-statut-badge" style={{background:STATUT_COLORS[c.statut]+'22',color:STATUT_COLORS[c.statut]}}>
                        {c.statut}
                      </span>
                    </td>
                    <td className="td-text td-muted">{c.localisation||'—'}</td>
                    <td className="td-text td-muted">{c.date_candidature||'—'}</td>
                    <td className="td-days">
                      {days !== null ? <span className={`td-days-badge ${urgent?'td-days-urgent':''}`}>J+{days}</span> : '—'}
                    </td>
                    <td>
                      {c.score > 0 ? <StarDisplay score={c.score} /> : <span className="td-muted">—</span>}
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <div className="table-actions">
                        <button className="icon-btn" title="Modifier" onClick={e => openEdit(c, e)}>✏️</button>
                        <button className="icon-btn" title="Dupliquer" onClick={e => duplicate(c, e)}>📋</button>
                        <button className="icon-btn" title={c.archived ? 'Désarchiver' : 'Archiver'} onClick={e => toggleArchive(c, e)}>{c.archived ? '📤' : '📦'}</button>
                        <button className="icon-btn" title="Supprimer" onClick={e => del(c.id, e)}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {tableSorted.length === 0 && (
                <tr><td colSpan={selectMode?9:8} className="table-empty">Aucune candidature trouvée</td></tr>
              )}
            </tbody>
          </table>
        </div>
      ) : view === 'list' ? (
        <div className="cand-list">
          {sorted.map((c, i) => {
            const days = daysSince(c.date_candidature);
            const urgent = days !== null && days >= 7 && ['Postulé','En attente'].includes(c.statut);
            const isSelected = selectedIds.has(c.id);
            return (
              <div
                className={`cand-card ${urgent ? 'urgent' : ''} ${c.priorite ? 'prioritaire' : ''} ${isSelected ? 'cand-card-selected' : ''}`}
                key={c.id}
                style={{animationDelay:`${i * 35}ms`}}
                onClick={() => selectMode ? toggleSelect(c.id, {stopPropagation:()=>{}}) : navigate('detail', c.id)}
              >
                <CompletionBar c={c} />
                {selectMode && (
                  <div className="cand-select-check" onClick={e => toggleSelect(c.id, e)}>
                    <input type="checkbox" checked={isSelected} onChange={() => {}} />
                  </div>
                )}
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
                      {c.date_entretien && <span>🎯 Entretien {c.date_entretien}</span>}
                    </div>
                    {c.tags && <TagPills tags={c.tags} />}
                    {c.score > 0 && <div style={{marginTop:4}}><StarDisplay score={c.score} /></div>}
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
                    <button className="icon-btn" title="Dupliquer" onClick={e => duplicate(c, e)}>📋</button>
                    <button className="icon-btn" title={c.archived ? 'Désarchiver' : 'Archiver'} onClick={e => toggleArchive(c, e)}>{c.archived ? '📤' : '📦'}</button>
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
              <div>{filterArchived ? 'Aucune candidature archivée' : 'Aucune candidature trouvée'}</div>
              {activeFilters && <div style={{fontSize:'0.8rem',marginTop:6,color:'var(--muted)'}}>Essaie d'effacer tes filtres</div>}
            </div>
          )}
        </div>
      ) : (
        <div className="kanban">
          {STATUTS.filter(s => !filterFocus || !FOCUS_EXCLUDE.includes(s)).map(statut => {
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
                      {c.tags && <TagPills tags={c.tags} />}
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
          <div className="parse-offer-section">
            <button type="button" className="btn-parse-offer" onClick={() => setShowParse(s => !s)}>
              ✨ {showParse ? 'Masquer' : "Importer une offre avec l'IA"}
            </button>
            {showParse && (
              <div className="parse-offer-box">
                <div className="parse-mode-tabs">
                  <button type="button" className={`parse-mode-tab${parseMode==='text'?' active':''}`} onClick={() => setParseMode('text')}>📋 Coller du texte</button>
                  <button type="button" className={`parse-mode-tab${parseMode==='url'?' active':''}`} onClick={() => setParseMode('url')}>🔗 Depuis une URL</button>
                </div>
                {parseMode === 'text' ? (
                  <>
                    <textarea
                      className="parse-textarea"
                      rows={4}
                      placeholder="Colle ici le texte de l'offre d'emploi (depuis LinkedIn, Indeed, etc.)…"
                      value={parseText}
                      onChange={e => setParseText(e.target.value)}
                    />
                    <button type="button" className="btn-parse-run" onClick={runParse} disabled={parsePending || !parseText.trim()}>
                      {parsePending ? '⏳ Analyse…' : '🔍 Remplir le formulaire'}
                    </button>
                  </>
                ) : (
                  <>
                    <input
                      type="url"
                      className="parse-url-input"
                      placeholder="https://www.indeed.com/viewjob?jk=… ou APEC, Hellowork…"
                      value={parseUrl}
                      onChange={e => setParseUrl(e.target.value)}
                    />
                    <div className="parse-url-hint">💡 LinkedIn requiert d'être connecté — utilise le mode Texte comme alternative.</div>
                    <button type="button" className="btn-parse-run" onClick={runParseUrl} disabled={parsePending || !parseUrl.trim()}>
                      {parsePending ? '⏳ Import en cours…' : '🚀 Importer l\'offre'}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
          <div className="form-grid">
            <div className="form-group full">
              <label>Entreprise *</label>
              <input value={form.entreprise} onChange={e => { setForm({...form, entreprise:e.target.value}); checkDoublon(e.target.value); }} placeholder="Ex: CAPGEMINI" autoFocus />
              {doublonWarning && <div className="doublon-warning">{doublonWarning}</div>}
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
            <div className="form-group">
              <label>Tags</label>
              <input value={form.tags||''} onChange={e => setForm({...form, tags:e.target.value})} placeholder="Ex: cloud, stage, CDI (séparés par des virgules)" />
            </div>
            <div className="form-group">
              <label>Salaire / Indemnité</label>
              <input value={form.salaire||''} onChange={e => setForm({...form, salaire:e.target.value})} placeholder="Ex: 900 €/mois" />
            </div>
            <div className="form-group">
              <label>Secteur</label>
              <select value={form.secteur||''} onChange={e => setForm({...form, secteur:e.target.value})}>
                {SECTEURS.map(s => <option key={s} value={s}>{s || 'Sélectionner…'}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Taille de l'entreprise</label>
              <select value={form.taille||''} onChange={e => setForm({...form, taille:e.target.value})}>
                {TAILLES.map(s => <option key={s} value={s}>{s || 'Sélectionner…'}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Date de rappel</label>
              <input type="date" value={form.date_rappel||''} onChange={e => setForm({...form, date_rappel:e.target.value})} />
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

      {pendingDelete && (
        <div className="toast toast-undo">
          🗑️ <strong>{pendingDelete.cand?.entreprise}</strong> supprimée dans 5s…
          <button className="toast-undo-btn" onClick={cancelDelete}>Annuler</button>
        </div>
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
