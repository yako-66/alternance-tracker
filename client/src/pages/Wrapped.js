import React, { useState, useEffect } from 'react';
import { api } from '../hooks/api';
import './Wrapped.css';

const YEAR = new Date().getFullYear();

export default function Wrapped({ navigate }) {
  const [list, setList] = useState([]);
  const [slide, setSlide] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api.get('/api/candidatures').then(data => {
      setList(data.filter(c => (c.date_candidature||'').startsWith(YEAR)));
      setLoaded(true);
    });
  }, []);

  const total = list.length;
  const entretiens = list.filter(c => ['Entretien','Offre','Acceptée'].includes(c.statut)).length;
  const refus = list.filter(c => c.statut === 'Refus').length;
  const taux = total ? Math.round(entretiens / total * 100) : 0;

  const monthCounts = {};
  list.forEach(c => {
    const m = (c.date_candidature||'').slice(0,7);
    if (m) monthCounts[m] = (monthCounts[m]||0)+1;
  });
  const topMonth = Object.entries(monthCounts).sort((a,b)=>b[1]-a[1])[0];
  const topMonthLabel = topMonth ? new Date(topMonth[0]+'-01').toLocaleDateString('fr-FR',{month:'long', year:'numeric'}) : '—';
  const topMonthCount = topMonth?.[1] || 0;

  const srcCounts = {};
  list.forEach(c => { if (c.source) srcCounts[c.source] = (srcCounts[c.source]||0)+1; });
  const topSrc = Object.entries(srcCounts).sort((a,b)=>b[1]-a[1])[0]?.[0] || '—';

  const secCounts = {};
  list.forEach(c => { if (c.secteur) secCounts[c.secteur] = (secCounts[c.secteur]||0)+1; });
  const topSec = Object.entries(secCounts).sort((a,b)=>b[1]-a[1])[0]?.[0] || '—';

  const SLIDES = [
    {
      bg: 'linear-gradient(135deg,#7C3AED,#9C27B0)',
      emoji: '🎯',
      title: `${YEAR} en alternance`,
      subtitle: "Ton bilan de l'année",
      stat: null,
    },
    {
      bg: 'linear-gradient(135deg,#06B6D4,#3B82F6)',
      emoji: '📋',
      title: `${total}`,
      subtitle: `candidature${total > 1 ? 's' : ''} envoyée${total > 1 ? 's' : ''}`,
      stat: total > 0 ? 'Tu es dans le top des candidats actifs !' : 'Commence à postuler !',
    },
    {
      bg: 'linear-gradient(135deg,#10B981,#059669)',
      emoji: '🎤',
      title: `${entretiens}`,
      subtitle: `entretien${entretiens > 1 ? 's' : ''} décroché${entretiens > 1 ? 's' : ''}`,
      stat: `Taux de conversion : ${taux}%`,
    },
    {
      bg: 'linear-gradient(135deg,#F59E0B,#EF4444)',
      emoji: '📅',
      title: topMonthLabel,
      subtitle: 'ton mois le plus actif',
      stat: `${topMonthCount} candidature${topMonthCount > 1 ? 's' : ''} ce mois-là`,
    },
    {
      bg: 'linear-gradient(135deg,#8B5CF6,#EC4899)',
      emoji: '🔗',
      title: topSrc,
      subtitle: 'ta plateforme préférée',
      stat: 'Continue à diversifier tes sources !',
    },
    {
      bg: 'linear-gradient(135deg,#0EA5E9,#6366F1)',
      emoji: '🏢',
      title: topSec || 'Tous secteurs',
      subtitle: 'ton secteur dominant',
      stat: secCounts[topSec] ? `${secCounts[topSec]} offre${secCounts[topSec]>1?'s':''} dans ce secteur` : '',
    },
    {
      bg: 'linear-gradient(135deg,#7C3AED,#DB2777)',
      emoji: '🚀',
      title: 'Continue !',
      subtitle: `${YEAR+1} sera encore meilleur`,
      stat: refus > 0 ? `${refus} refus = ${refus} leçons apprises` : 'Tu assures !',
      isLast: true,
    },
  ];

  const current = SLIDES[slide];

  if (!loaded) return <div className="wrapped-loading">Préparation de ton bilan… 🎁</div>;

  return (
    <div className="wrapped-page" style={{ background: current.bg }}>
      <div className="wrapped-dots">
        {SLIDES.map((_, i) => (
          <div key={i} className={`wrapped-dot ${i === slide ? 'active' : ''} ${i < slide ? 'done' : ''}`} onClick={() => setSlide(i)} />
        ))}
      </div>

      <div className="wrapped-slide" key={slide}>
        <div className="wrapped-emoji">{current.emoji}</div>
        <div className="wrapped-stat-number">{current.title}</div>
        <div className="wrapped-stat-label">{current.subtitle}</div>
        {current.stat && <div className="wrapped-stat-sub">{current.stat}</div>}
        {current.isLast && (
          <button className="wrapped-back-btn" onClick={() => navigate('dashboard')}>
            Retour au Dashboard →
          </button>
        )}
      </div>

      <div className="wrapped-nav">
        {slide > 0 && (
          <button className="wrapped-nav-btn" onClick={() => setSlide(s => s - 1)}>←</button>
        )}
        {slide < SLIDES.length - 1 && (
          <button className="wrapped-nav-btn wrapped-nav-next" onClick={() => setSlide(s => s + 1)}>→</button>
        )}
      </div>

      <button className="wrapped-skip" onClick={() => navigate('dashboard')}>✕ Fermer</button>
    </div>
  );
}
