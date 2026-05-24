import { useState, useEffect } from 'react';

export const ACHIEVEMENTS = [
  { id: 'first_cand',      icon: '🎯', title: 'Première candidature',  desc: 'Envoyer sa toute première candidature.',         check: l => l.length >= 1 },
  { id: 'ten_cands',       icon: '🔥', title: '10 candidatures',       desc: '10 candidatures envoyées, ça décolle !',         check: l => l.length >= 10 },
  { id: 'twenty_five',     icon: '💪', title: '25 candidatures',       desc: 'La régularité, c\'est la clé.',                  check: l => l.length >= 25 },
  { id: 'fifty_cands',     icon: '🏆', title: '50 candidatures',       desc: 'Incroyable détermination !',                    check: l => l.length >= 50 },
  { id: 'first_entretien', icon: '🎉', title: 'Premier entretien',     desc: 'Tu as décroché un entretien !',                 check: l => l.some(c => c.statut === 'Entretien') },
  { id: 'five_entretiens', icon: '⭐', title: '5 entretiens',          desc: 'Cinq entretiens, tu es en feu !',               check: l => l.filter(c => c.statut === 'Entretien').length >= 5 },
  { id: 'perfectionist',   icon: '✨', title: 'Perfectionniste',       desc: 'Une candidature remplie à 100%.',               check: l => l.some(c => [c.entreprise,c.poste,c.source,c.contact,c.localisation,c.notes,c.date_candidature,c.date_entretien,c.score>0?'y':''].every(Boolean)) },
  { id: 'multi_city',      icon: '🗺️', title: 'Multi-villes',          desc: 'Candidatures dans 3 villes différentes.',       check: l => new Set(l.map(c=>c.localisation).filter(Boolean)).size >= 3 },
  { id: 'stratege',        icon: '🔥', title: 'Stratège',              desc: '5 candidatures marquées prioritaires.',          check: l => l.filter(c=>c.priorite===1).length >= 5 },
  { id: 'relanceur',       icon: '📨', title: 'Relanceur',             desc: 'Passer 3 candidatures en "En attente de réponse"', check: l => l.filter(c=>c.statut==='En attente de réponse').length >= 3 },
  { id: 'networker',       icon: '🤝', title: 'Networker',             desc: '5 candidatures avec un contact renseigné.',     check: l => l.filter(c=>c.contact).length >= 5 },
];

export function useAchievements(list) {
  const [newAchievement, setNewAchievement] = useState(null);

  useEffect(() => {
    if (!list || list.length === 0) return;
    const unlocked = JSON.parse(localStorage.getItem('achievements') || '[]');
    for (const ach of ACHIEVEMENTS) {
      if (!unlocked.includes(ach.id) && ach.check(list)) {
        const updated = [...unlocked, ach.id];
        localStorage.setItem('achievements', JSON.stringify(updated));
        setNewAchievement(ach);
        setTimeout(() => setNewAchievement(null), 6000);
        break;
      }
    }
  }, [list]);

  const getAllWithStatus = () => {
    const unlocked = JSON.parse(localStorage.getItem('achievements') || '[]');
    return ACHIEVEMENTS.map(a => ({ ...a, unlocked: unlocked.includes(a.id) }));
  };

  return { newAchievement, getAllWithStatus };
}
