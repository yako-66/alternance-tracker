import React, { useEffect, useState } from 'react';
import { api } from '../hooks/api';
import './GlobalTimeline.css';

const STATUT_COLORS = {
  'Postulé':'#4ecdc4','En attente':'#ff9f43','En attente de réponse':'#ffd93d',
  'Entretien':'#00d4a0','Refus':'#ff6b6b','Sans suite':'#4a4a60'
};

const TYPE_ICONS = {
  'Email reçu':'📩','Email envoyé':'📤','Appel téléphonique':'📞',
  'Message LinkedIn':'💼','Entretien':'🎯','Relance':'🔁','Note':'📝',
};

function parseDate(str) {
  if (!str) return null;
  const parts = str.includes('/') ? str.split('/').reverse() : str.split('-');
  const d = new Date(parts.join('-'));
  return isNaN(d) ? null : d;
}

function groupByMonth(items) {
  const groups = {};
  items.forEach(item => {
    const d = parseDate(item.date);
    if (!d) return;
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    if (!groups[key]) groups[key] = { label: d.toLocaleDateString('fr-FR',{month:'long',year:'numeric'}), items:[] };
    groups[key].items.push(item);
  });
  return Object.entries(groups).sort((a,b) => b[0].localeCompare(a[0]));
}

export default function GlobalTimeline({ navigate }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    const load = async () => {
      const cands = await api.get('/api/candidatures');
      const allEvents = [];

      // Candidatures elles-mêmes
      cands.forEach(c => {
        if (c.date_candidature) {
          allEvents.push({
            date: c.date_candidature, type: 'candidature',
            label: 'Candidature envoyée', entreprise: c.entreprise,
            poste: c.poste, statut: c.statut, id: c.id,
          });
        }
        if (c.date_entretien) {
          const d = parseDate(c.date_entretien);
          const isPast = d && d < new Date();
          allEvents.push({
            date: c.date_entretien, type: 'entretien',
            label: isPast ? 'Entretien passé' : 'Entretien à venir',
            entreprise: c.entreprise, poste: c.poste, statut: c.statut, id: c.id,
          });
        }
      });

      // Échanges
      for (const c of cands) {
        try {
          const echanges = await api.get(`/api/candidatures/${c.id}/echanges`);
          echanges.forEach(e => {
            allEvents.push({
              date: e.date, type: 'echange', label: e.type, contenu: e.contenu,
              entreprise: c.entreprise, statut: c.statut, id: c.id,
            });
          });
        } catch {}
      }

      // Trie par date décroissante
      allEvents.sort((a, b) => {
        const da = parseDate(a.date), db = parseDate(b.date);
        if (!da && !db) return 0;
        if (!da) return 1; if (!db) return -1;
        return db - da;
      });

      setEvents(allEvents);
      setLoading(false);
    };
    load();
  }, []);

  const filtered = filter
    ? events.filter(e => e.type === filter || e.label === filter)
    : events;

  const grouped = groupByMonth(filtered);

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <div className="timeline-page">
      <div className="timeline-header">
        <h1 className="page-title">🕐 Timeline globale</h1>
        <div className="timeline-filters">
          {[
            { val:'', label:'Tout' },
            { val:'candidature', label:'📤 Candidatures' },
            { val:'entretien', label:'🎯 Entretiens' },
            { val:'echange', label:'💬 Échanges' },
          ].map(f => (
            <button
              key={f.val}
              className={`timeline-filter-btn ${filter === f.val ? 'active' : ''}`}
              onClick={() => setFilter(f.val)}
            >{f.label}</button>
          ))}
        </div>
      </div>

      {grouped.length === 0 && (
        <div className="timeline-empty">Aucun événement à afficher.</div>
      )}

      {grouped.map(([key, group]) => (
        <div className="timeline-month-group" key={key}>
          <div className="timeline-month-label">{group.label}</div>
          <div className="timeline-events">
            {group.items.map((ev, i) => {
              const color = STATUT_COLORS[ev.statut] || '#9a9aa8';
              const icon = ev.type === 'candidature' ? '📤'
                : ev.type === 'entretien' ? '🎯'
                : TYPE_ICONS[ev.label] || '💬';
              return (
                <div
                  key={i}
                  className={`timeline-event timeline-event-${ev.type}`}
                  onClick={() => navigate('detail', ev.id)}
                >
                  <div className="timeline-event-icon">{icon}</div>
                  <div className="timeline-event-line" style={{background:color+'33'}} />
                  <div className="timeline-event-body">
                    <div className="timeline-event-top">
                      <span className="timeline-event-entreprise">{ev.entreprise}</span>
                      <span className="timeline-event-date">
                        {parseDate(ev.date)?.toLocaleDateString('fr-FR',{day:'numeric',month:'short'})}
                      </span>
                    </div>
                    <div className="timeline-event-label">{ev.label}</div>
                    {ev.contenu && <div className="timeline-event-contenu">{ev.contenu}</div>}
                    {ev.poste && <div className="timeline-event-poste">{ev.poste}</div>}
                    <span className="timeline-event-statut" style={{background:color+'20',color}}>
                      {ev.statut}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
