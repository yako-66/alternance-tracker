import React, { useEffect, useState } from 'react';
import { api } from '../hooks/api';
import './Comparateur.css';

const STATUT_COLORS = {
  'Postulé':'#4ecdc4','En attente':'#ff9f43','En attente de réponse':'#ffd93d',
  'Entretien':'#00d4a0','Refus':'#ff6b6b','Sans suite':'#4a4a60'
};

const FIELDS = [
  { key:'statut',           label:'Statut' },
  { key:'localisation',     label:'Localisation' },
  { key:'source',           label:'Source' },
  { key:'date_candidature', label:'Date candidature' },
  { key:'date_entretien',   label:'Date entretien' },
  { key:'contact',          label:'Contact' },
  { key:'salaire',          label:'Salaire' },
  { key:'secteur',          label:'Secteur' },
  { key:'taille',           label:'Taille entreprise' },
  { key:'score',            label:'Intérêt' },
  { key:'tags',             label:'Tags' },
  { key:'notes',            label:'Notes' },
];

function Stars({ score }) {
  return <span>{[1,2,3,4,5].map(i => <span key={i} style={{color: i <= score ? '#F59E0B' : '#D1C4E9'}}>★</span>)}</span>;
}

export default function Comparateur({ navigate }) {
  const [list, setList] = useState([]);
  const [selected, setSelected] = useState([null, null, null]);
  const [search, setSearch] = useState(['','','']);

  useEffect(() => {
    api.get('/api/candidatures').then(data => setList(data.filter(c => !c.archived)));
  }, []);

  const updateSlot = (idx, id) => {
    const next = [...selected];
    next[idx] = id ? list.find(c => c.id === parseInt(id)) : null;
    setSelected(next);
  };

  const updateSearch = (idx, val) => {
    const next = [...search];
    next[idx] = val;
    setSearch(next);
  };

  const filtered = (idx) => {
    const q = search[idx].toLowerCase();
    return list.filter(c => !q || c.entreprise?.toLowerCase().includes(q) || c.poste?.toLowerCase().includes(q));
  };

  const active = selected.filter(Boolean);

  const getBest = (key) => {
    if (active.length < 2) return null;
    if (key === 'score') return Math.max(...active.map(c => c.score || 0));
    if (key === 'statut') {
      const order = ['Entretien','En attente de réponse','En attente','Postulé','Sans suite','Refus'];
      return active.reduce((best, c) => order.indexOf(c.statut) < order.indexOf(best.statut) ? c : best).statut;
    }
    return null;
  };

  return (
    <div className="comp-page">
      <h1 className="page-title">⚖️ Comparateur d'offres</h1>
      <p className="comp-intro">Sélectionne jusqu'à 3 candidatures pour les comparer côte à côte.</p>

      <div className="comp-slots">
        {[0,1,2].map(idx => (
          <div key={idx} className={`comp-slot ${selected[idx] ? 'comp-slot-filled' : ''}`}>
            <div className="comp-slot-header">
              <span className="comp-slot-num">#{idx + 1}</span>
              {selected[idx] && (
                <button className="comp-slot-clear" onClick={() => updateSlot(idx, null)}>✕</button>
              )}
            </div>
            {!selected[idx] ? (
              <div className="comp-slot-picker">
                <input
                  className="comp-search"
                  placeholder="Chercher une entreprise…"
                  value={search[idx]}
                  onChange={e => updateSearch(idx, e.target.value)}
                />
                <div className="comp-dropdown">
                  {filtered(idx).slice(0,6).map(c => (
                    <div key={c.id} className="comp-option" onClick={() => { updateSlot(idx, c.id); updateSearch(idx, ''); }}>
                      <div className="comp-opt-avatar">{c.entreprise[0]}</div>
                      <div>
                        <div className="comp-opt-name">{c.entreprise}</div>
                        <div className="comp-opt-sub">{c.poste} {c.localisation ? `· ${c.localisation}` : ''}</div>
                      </div>
                    </div>
                  ))}
                  {filtered(idx).length === 0 && <div className="comp-opt-empty">Aucun résultat</div>}
                </div>
              </div>
            ) : (
              <div className="comp-selected-header">
                <div className="comp-sel-avatar">{selected[idx].entreprise[0]}</div>
                <div>
                  <div className="comp-sel-name">{selected[idx].entreprise}</div>
                  <div className="comp-sel-poste">{selected[idx].poste}</div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {active.length >= 2 && (
        <div className="comp-table-wrap">
          <table className="comp-table">
            <thead>
              <tr>
                <th className="comp-th comp-th-label">Critère</th>
                {active.map(c => (
                  <th key={c.id} className="comp-th">
                    <div className="comp-th-avatar">{c.entreprise[0]}</div>
                    <div className="comp-th-name">{c.entreprise}</div>
                    <div className="comp-th-poste">{c.poste}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FIELDS.map(f => {
                const best = getBest(f.key);
                return (
                  <tr key={f.key} className="comp-row">
                    <td className="comp-td comp-td-label">{f.label}</td>
                    {active.map(c => {
                      const val = c[f.key];
                      const isBest = best !== null && val === best;
                      return (
                        <td key={c.id} className={`comp-td ${isBest ? 'comp-td-best' : ''}`}>
                          {f.key === 'statut' && val ? (
                            <span className="comp-statut" style={{background:STATUT_COLORS[val]+'22',color:STATUT_COLORS[val]}}>{val}</span>
                          ) : f.key === 'score' && val ? (
                            <Stars score={val} />
                          ) : f.key === 'tags' && val ? (
                            <div className="comp-tags">{val.split(',').map(t => t.trim()).filter(Boolean).map(t => <span key={t} className="comp-tag">{t}</span>)}</div>
                          ) : f.key === 'notes' && val ? (
                            <span className="comp-notes-val">{val.length > 120 ? val.slice(0, 120) + '…' : val}</span>
                          ) : (
                            <span className={val ? '' : 'comp-empty'}>{val || '—'}</span>
                          )}
                          {isBest && <span className="comp-best-badge">★ Meilleur</span>}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="comp-actions">
            {active.map(c => (
              <button key={c.id} className="btn-primary" onClick={() => navigate('detail', c.id)}>
                Ouvrir {c.entreprise} →
              </button>
            ))}
          </div>
        </div>
      )}

      {active.length < 2 && (
        <div className="comp-empty-state">
          <div style={{fontSize:'3rem'}}>⚖️</div>
          <div>Sélectionne au moins 2 candidatures pour comparer</div>
        </div>
      )}
    </div>
  );
}
