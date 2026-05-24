import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../hooks/api';
import './PrepEntretien.css';

const CATEGORIES = [
  {
    id: 'presentation', icon: '👤', title: 'Présentation',
    questions: [
      'Présentez-vous en 2 minutes (pitch elevator)',
      'Pourquoi cette formation en alternance ?',
      'Quelles sont vos 3 principales qualités ?',
      'Quel est votre principal défaut et comment le gérez-vous ?',
    ]
  },
  {
    id: 'motivation', icon: '🎯', title: 'Motivation',
    questions: [
      'Pourquoi postulez-vous chez nous plutôt qu\'ailleurs ?',
      'Que savez-vous de notre entreprise ?',
      'Où vous voyez-vous dans 5 ans ?',
      'Qu\'est-ce qui vous attire dans le domaine Infra/Cloud/IT ?',
    ]
  },
  {
    id: 'competences', icon: '💡', title: 'Compétences techniques',
    questions: [
      'Décrivez un projet technique dont vous êtes fier(e).',
      'Quels outils/technologies maîtrisez-vous ?',
      'Comment gérez-vous une panne ou un incident critique ?',
      'Expliquez la différence entre virtualisation et conteneurisation.',
    ]
  },
  {
    id: 'soft', icon: '🤝', title: 'Soft skills / Comportemental',
    questions: [
      'Décrivez une situation de conflit et comment vous l\'avez résolue.',
      'Parlez d\'un projet de groupe difficile — quel a été votre rôle ?',
      'Comment gérez-vous le stress et les deadlines serrées ?',
      'Donnez un exemple où vous avez pris une initiative.',
    ]
  },
  {
    id: 'alternance', icon: '📚', title: 'Rythme alternance',
    questions: [
      'Quel rythme d\'alternance propose votre école ?',
      'Comment organisez-vous votre temps entre école et entreprise ?',
      'Quand seriez-vous disponible pour commencer ?',
      'Avez-vous des contraintes (examens, projet école) à anticiper ?',
    ]
  },
  {
    id: 'questions', icon: '❓', title: 'Tes questions à poser',
    questions: [
      'Quelles seraient mes missions principales les 3 premiers mois ?',
      'Avec quelle équipe vais-je travailler au quotidien ?',
      'Y a-t-il des opportunités de CDI après l\'alternance ?',
      'Comment se passe l\'onboarding pour les alternants ?',
    ]
  },
];

const STAR_TEMPLATE = `Situation : [Décris le contexte]

Tâche : [Quelle était ta mission ?]

Action : [Qu'as-tu fait concrètement ?]

Résultat : [Quel a été l'impact mesurable ?]`;

export default function PrepEntretien({ navigate }) {
  const [list, setList] = useState([]);
  const [selectedCand, setSelectedCand] = useState(null);
  const [activeCategory, setActiveCategory] = useState('presentation');
  const [notes, setNotes] = useState(() => {
    try { return JSON.parse(localStorage.getItem('prep_notes') || '{}'); } catch { return {}; }
  });
  const [starAnswers, setStarAnswers] = useState(() => {
    try { return JSON.parse(localStorage.getItem('prep_star') || '{}'); } catch { return {}; }
  });
  const [starOpen, setStarOpen] = useState(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get('/api/candidatures').then(data => setList(data.filter(c => !c.archived)));
  }, []);

  const saveNote = useCallback((catId, qIdx, val) => {
    const key = `${catId}_${qIdx}`;
    const updated = { ...notes, [key]: val };
    setNotes(updated);
    localStorage.setItem('prep_notes', JSON.stringify(updated));
  }, [notes]);

  const saveStarAnswer = useCallback((idx, val) => {
    const updated = { ...starAnswers, [idx]: val };
    setStarAnswers(updated);
    localStorage.setItem('prep_star', JSON.stringify(updated));
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }, [starAnswers]);

  const filledCount = (catId) => {
    const cat = CATEGORIES.find(c => c.id === catId);
    return cat.questions.filter((_, i) => notes[`${catId}_${i}`]?.trim()).length;
  };

  const totalFilled = CATEGORIES.reduce((acc, cat) => acc + filledCount(cat.id), 0);
  const totalQ = CATEGORIES.reduce((acc, cat) => acc + cat.questions.length, 0);

  const activeCat = CATEGORIES.find(c => c.id === activeCategory);

  return (
    <div className="prep-page">
      <div className="prep-header">
        <h1 className="page-title">🎤 Préparation entretien</h1>
        <div className="prep-progress-wrap">
          <div className="prep-progress-bar">
            <div className="prep-progress-fill" style={{width:`${(totalFilled/totalQ)*100}%`}} />
          </div>
          <span className="prep-progress-label">{totalFilled}/{totalQ} questions préparées</span>
        </div>
      </div>

      {/* Sélection candidature */}
      <div className="prep-cand-select-wrap">
        <label className="prep-label">Préparer pour :</label>
        <select className="prep-cand-select" value={selectedCand?.id || ''} onChange={e => setSelectedCand(list.find(c => c.id === parseInt(e.target.value)) || null)}>
          <option value="">— Général (sans candidature spécifique)</option>
          {list.map(c => (
            <option key={c.id} value={c.id}>{c.entreprise}{c.poste ? ` — ${c.poste}` : ''}</option>
          ))}
        </select>
        {selectedCand && (
          <div className="prep-cand-info">
            <span>📍 {selectedCand.localisation || '—'}</span>
            <span>📅 Entretien : {selectedCand.date_entretien || 'non défini'}</span>
            <button className="prep-cand-link" onClick={() => navigate('detail', selectedCand.id)}>Ouvrir la fiche →</button>
          </div>
        )}
      </div>

      <div className="prep-layout">
        {/* Sidebar catégories */}
        <div className="prep-sidebar">
          {CATEGORIES.map(cat => {
            const filled = filledCount(cat.id);
            const total = cat.questions.length;
            return (
              <button
                key={cat.id}
                className={`prep-cat-btn ${activeCategory === cat.id ? 'active' : ''} ${filled === total ? 'completed' : ''}`}
                onClick={() => setActiveCategory(cat.id)}
              >
                <span className="prep-cat-icon">{cat.icon}</span>
                <span className="prep-cat-title">{cat.title}</span>
                <span className="prep-cat-count">{filled}/{total}</span>
              </button>
            );
          })}
          <div className="prep-sidebar-divider" />
          <button
            className={`prep-cat-btn ${activeCategory === 'star' ? 'active' : ''}`}
            onClick={() => setActiveCategory('star')}
          >
            <span className="prep-cat-icon">⭐</span>
            <span className="prep-cat-title">Méthode STAR</span>
          </button>
        </div>

        {/* Contenu questions */}
        <div className="prep-content">
          {activeCategory === 'star' ? (
            <div className="prep-star-section">
              <div className="prep-section-title">⭐ Méthode STAR — Situations clés</div>
              <p className="prep-section-desc">Prépare des anecdotes structurées pour répondre aux questions comportementales.</p>
              {[0,1,2,3].map(i => (
                <div key={i} className="prep-star-card">
                  <div className="prep-star-header" onClick={() => setStarOpen(starOpen === i ? null : i)}>
                    <span className="prep-star-num">Situation {i + 1}</span>
                    <span className="prep-star-preview">
                      {starAnswers[i]?.split('\n')[0]?.replace(/^Situation : /, '') || 'Non remplie'}
                    </span>
                    <span>{starOpen === i ? '▲' : '▼'}</span>
                  </div>
                  {starOpen === i && (
                    <div className="prep-star-body">
                      <textarea
                        className="prep-star-textarea"
                        value={starAnswers[i] || STAR_TEMPLATE}
                        onChange={e => saveStarAnswer(i, e.target.value)}
                        rows={10}
                        placeholder={STAR_TEMPLATE}
                      />
                    </div>
                  )}
                </div>
              ))}
              {saved && <div className="prep-save-toast">✅ Sauvegardé</div>}
            </div>
          ) : activeCat ? (
            <div className="prep-questions">
              <div className="prep-section-title">{activeCat.icon} {activeCat.title}</div>
              {activeCat.questions.map((q, i) => {
                const key = `${activeCat.id}_${i}`;
                const val = notes[key] || '';
                return (
                  <div key={i} className={`prep-question-card ${val.trim() ? 'prepared' : ''}`}>
                    <div className="prep-q-text">
                      <span className="prep-q-num">{i + 1}.</span> {q}
                      {val.trim() && <span className="prep-q-check">✓</span>}
                    </div>
                    <textarea
                      className="prep-q-textarea"
                      value={val}
                      onChange={e => saveNote(activeCat.id, i, e.target.value)}
                      rows={3}
                      placeholder="Ta réponse préparée…"
                    />
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
