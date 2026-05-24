import React, { useEffect, useState } from 'react';
import { api } from '../hooks/api';
import './Calendar.css';

const STATUT_COLORS = {
  'Postulé':'#4ecdc4','En attente':'#ff9f43','En attente de réponse':'#ffd93d',
  'Entretien':'#00d4a0','Refus':'#ff6b6b','Sans suite':'#4a4a60'
};

const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const DAYS = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];

function parseDate(str) {
  if (!str) return null;
  const parts = str.includes('/') ? str.split('/').reverse() : str.split('-');
  const d = new Date(parts.join('-'));
  return isNaN(d) ? null : d;
}

function toKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

export default function Calendar({ navigate }) {
  const [list, setList] = useState([]);
  const [year, setYear]   = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());
  const [selected, setSelected] = useState(null);

  useEffect(() => { api.get('/api/candidatures').then(setList); }, []);

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y=>y-1); } else setMonth(m=>m-1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y=>y+1); } else setMonth(m=>m+1); };
  const goToday = () => { setYear(new Date().getFullYear()); setMonth(new Date().getMonth()); setSelected(null); };

  // Construit la grille calendrier
  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month + 1, 0);
  const startDow = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1; // lundi=0
  const days = [];
  for (let i = 0; i < startDow; i++) days.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d));

  // Index des candidatures par date (candidature + entretien)
  const byDate = {};
  list.forEach(c => {
    const d1 = parseDate(c.date_candidature);
    if (d1) { const k = toKey(d1); if (!byDate[k]) byDate[k] = []; byDate[k].push({...c, _type:'candidature'}); }
    const d2 = parseDate(c.date_entretien);
    if (d2) { const k = toKey(d2); if (!byDate[k]) byDate[k] = []; byDate[k].push({...c, _type:'entretien'}); }
  });

  const today = toKey(new Date());
  const selectedItems = selected ? (byDate[selected] || []) : [];

  return (
    <div className="calendar-page">
      <div className="cal-header">
        <h1 className="page-title">📅 Calendrier</h1>
        <div className="cal-nav">
          <button className="cal-nav-btn" onClick={prevMonth}>‹</button>
          <button className="cal-month-label" onClick={goToday}>
            {MONTHS[month]} {year}
          </button>
          <button className="cal-nav-btn" onClick={nextMonth}>›</button>
        </div>
      </div>

      <div className="cal-legend-row">
        <span className="cal-legend-item"><span className="cal-dot" style={{background:'var(--accent)'}} />Candidature</span>
        <span className="cal-legend-item"><span className="cal-dot cal-dot-entretien" />Entretien</span>
      </div>

      <div className="cal-grid-wrap">
        <div className="cal-dow-row">
          {DAYS.map(d => <div className="cal-dow" key={d}>{d}</div>)}
        </div>
        <div className="cal-grid">
          {days.map((d, i) => {
            if (!d) return <div className="cal-cell cal-cell-empty" key={`e${i}`} />;
            const key = toKey(d);
            const items = byDate[key] || [];
            const isToday = key === today;
            const isSelected = selected === key;
            const cands = items.filter(x => x._type === 'candidature');
            const entretiens = items.filter(x => x._type === 'entretien');
            return (
              <div
                key={key}
                className={`cal-cell ${isToday ? 'cal-today' : ''} ${isSelected ? 'cal-selected' : ''} ${items.length ? 'cal-has-events' : ''}`}
                onClick={() => setSelected(isSelected ? null : key)}
              >
                <div className="cal-day-num">{d.getDate()}</div>
                {cands.length > 0 && (
                  <div className="cal-events">
                    {cands.slice(0,3).map((c,j) => (
                      <div key={j} className="cal-event" style={{background: STATUT_COLORS[c.statut] || '#9a9aa8'}}>
                        {c.entreprise}
                      </div>
                    ))}
                    {cands.length > 3 && <div className="cal-event-more">+{cands.length-3}</div>}
                  </div>
                )}
                {entretiens.length > 0 && (
                  <div className="cal-entretien-dots">
                    {entretiens.map((_, j) => <span key={j} className="cal-dot-entretien-sm" />)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {selected && (
        <div className="cal-detail-panel">
          <div className="cal-detail-title">
            {new Date(selected).toLocaleDateString('fr-FR', {weekday:'long',day:'numeric',month:'long',year:'numeric'})}
            <button className="cal-close-btn" onClick={() => setSelected(null)}>×</button>
          </div>
          {selectedItems.length === 0 && (
            <p className="cal-empty">Aucun événement ce jour.</p>
          )}
          {selectedItems.map((c, i) => (
            <div
              key={i}
              className={`cal-detail-item ${c._type === 'entretien' ? 'cal-detail-entretien' : ''}`}
              onClick={() => navigate('detail', c.id)}
            >
              <div className="cal-detail-left">
                <div className="cal-detail-badge" style={{background: c._type === 'entretien' ? '#00d4a0' : STATUT_COLORS[c.statut]}}>
                  {c._type === 'entretien' ? '🎯 Entretien' : '📤 Candidature'}
                </div>
                <div className="cal-detail-entreprise">{c.entreprise}</div>
                {c.poste && <div className="cal-detail-poste">{c.poste}</div>}
              </div>
              <span className="cal-detail-arrow">→</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
