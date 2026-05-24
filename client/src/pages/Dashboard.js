import React, { useEffect, useState, useRef } from 'react';
import { api } from '../hooks/api';
import { useAchievements } from '../hooks/useAchievements';
import './Dashboard.css';

function useCountUp(target, duration = 900) {
  const [count, setCount] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    if (target === prev.current) return;
    const start = Date.now();
    const startVal = prev.current;
    const delta = target - startVal;
    if (delta === 0) return;
    const frame = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(startVal + eased * delta));
      if (progress < 1) requestAnimationFrame(frame);
      else { setCount(target); prev.current = target; }
    };
    requestAnimationFrame(frame);
  }, [target, duration]);
  return count;
}

const STATUT_CONFIG = {
  'Postulé':               { color: '#4ecdc4', emoji: '📤' },
  'En attente':            { color: '#ff9f43', emoji: '⏳' },
  'En attente de réponse': { color: '#ffd93d', emoji: '💬' },
  'Entretien':             { color: '#00d4a0', emoji: '🎯' },
  'Refus':                 { color: '#ff6b6b', emoji: '❌' },
  'Sans suite':            { color: '#4a4a60', emoji: '🚫' },
};

const TIPS = [
  "Personnalise chaque lettre de motivation — les recruteurs voient la différence immédiatement.",
  "Relancer après 7 jours double tes chances d'obtenir une réponse. N'hésite pas !",
  "Engage avec les posts LinkedIn de tes cibles avant de postuler. La visibilité compte.",
  "Un contact interne multiplie par 6 les chances d'être vu par un recruteur.",
  "Les offres fraîches (< 48h) ont 3× plus de candidats triés — sois le premier à postuler.",
  "Prépare des histoires STAR pour chaque compétence clé listée dans l'offre.",
  "Ton réseau compte autant que ton CV — active-le dès aujourd'hui !",
];

const MOTIVATIONS = [
  { emoji: '🚀', msg: 'Chaque candidature est un pas vers ton avenir.' },
  { emoji: '💪', msg: 'La persévérance paie — continue comme ça !' },
  { emoji: '🎯', msg: 'Focus. Un entretien change tout.' },
  { emoji: '🌟', msg: 'Tu construis quelque chose de grand.' },
  { emoji: '🔥', msg: "L'effort d'aujourd'hui, le succès de demain." },
];

function daysSince(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.includes('/') ? dateStr.split('/').reverse() : dateStr.split('-');
  const d = new Date(parts.join('-'));
  if (isNaN(d)) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

function getWeekKey(date) {
  const d = new Date(date);
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

function getWeekLabel(key) {
  const [year, wPart] = key.split('-W');
  const week = parseInt(wPart);
  const jan1 = new Date(parseInt(year), 0, 1);
  const dayOffset = (week - 1) * 7 - jan1.getDay() + 1;
  const monday = new Date(jan1);
  monday.setDate(jan1.getDate() + dayOffset);
  return `${monday.getDate()}/${monday.getMonth() + 1}`;
}

function getWeekHistory() {
  const result = [];
  const now = new Date();
  for (let i = 7; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    const key = getWeekKey(d);
    result.push({
      key,
      label: i === 0 ? 'Cette sem.' : getWeekLabel(key),
      count: parseInt(localStorage.getItem(`week_hist_${key}`) || '0'),
      isCurrent: i === 0,
    });
  }
  return result;
}

function WeekSparkline({ weekHistory, objectif }) {
  const max = Math.max(...weekHistory.map(w => w.count), objectif, 1);
  return (
    <div className="week-sparkline">
      <div className="sparkline-title">📅 Historique des 8 dernières semaines</div>
      <div className="sparkline-bars">
        {weekHistory.map((w) => {
          const pct = (w.count / max) * 100;
          const reachedGoal = w.count >= objectif;
          return (
            <div key={w.key} className={`sparkline-col ${w.isCurrent ? 'sparkline-current' : ''}`}>
              <div className="sparkline-count-label">{w.count > 0 ? w.count : ''}</div>
              <div className="sparkline-bar-wrap">
                <div
                  className="sparkline-bar-fill"
                  style={{
                    height: `${Math.max(pct, w.count > 0 ? 8 : 0)}%`,
                    background: reachedGoal ? 'var(--green)' : w.isCurrent ? 'var(--gradient)' : 'var(--accent)',
                    opacity: w.isCurrent ? 1 : 0.65,
                  }}
                />
              </div>
              <div className="sparkline-label">{w.label}</div>
            </div>
          );
        })}
      </div>
      <div className="sparkline-goal-line" style={{bottom: `${Math.min((objectif / max) * 100, 95)}%`}}>
        <span className="sparkline-goal-label">Objectif {objectif}</span>
      </div>
    </div>
  );
}

function CountdownCard({ formation, targetDate }) {
  const TARGET = new Date(targetDate || '2026-10-01');
  const SEARCH_START = new Date('2026-01-01');
  const now = new Date();

  const msLeft = Math.max(0, TARGET - now);
  const daysLeft = Math.ceil(msLeft / 86400000);
  const weeksLeft = Math.floor(daysLeft / 7);
  const daysRemainder = daysLeft % 7;

  const totalSearchMs = TARGET - SEARCH_START;
  const elapsedSearchMs = Math.max(0, now - SEARCH_START);
  const searchPct = Math.min(Math.round((elapsedSearchMs / totalSearchMs) * 100), 100);
  const daysSinceStart = Math.floor(elapsedSearchMs / 86400000);

  const isClose = daysLeft <= 60;

  return (
    <div className={`countdown-card ${isClose ? 'countdown-urgent' : ''}`}>
      <div className="countdown-header">
        <span className="countdown-icon">🎓</span>
        <div>
          <div className="countdown-title">{formation || 'Mastère Infra & Cloud Xpert'}</div>
          <div className="countdown-sub">Rentrée — {TARGET.toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'})}</div>
        </div>
      </div>
      <div className="countdown-nums">
        <div className="countdown-block">
          <span className="countdown-num">{daysLeft}</span>
          <span className="countdown-unit">jours</span>
        </div>
        <div className="countdown-sep">·</div>
        <div className="countdown-block">
          <span className="countdown-num">{weeksLeft}</span>
          <span className="countdown-unit">semaines</span>
          {daysRemainder > 0 && <span className="countdown-unit-small">+{daysRemainder}j</span>}
        </div>
      </div>
      <div className="countdown-progress-label-top">
        Avancement de la recherche — {daysSinceStart}j depuis le début
      </div>
      <div className="countdown-progress-track">
        <div className="countdown-progress-fill" style={{width:`${searchPct}%`}} />
        <span className="countdown-progress-pct">{searchPct}%</span>
      </div>
    </div>
  );
}

function TipCard() {
  const now = new Date();
  const tip = TIPS[now.getDay()];
  const motiv = MOTIVATIONS[now.getDay() % MOTIVATIONS.length];
  return (
    <div className="tip-card">
      <div className="tip-motiv">
        <span className="tip-motiv-emoji">{motiv.emoji}</span>
        <span className="tip-motiv-text">{motiv.msg}</span>
      </div>
      <div className="tip-divider" />
      <div className="tip-label">💡 Conseil du jour</div>
      <p className="tip-text">"{tip}"</p>
    </div>
  );
}

function checkNotifications(upcomingInterviews) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  const today = new Date(); today.setHours(0,0,0,0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowEnd = new Date(tomorrow); tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
  const lastNotif = localStorage.getItem('last_interview_notif');
  const todayStr = today.toISOString().split('T')[0];
  if (lastNotif === todayStr) return;
  const tmInterviews = upcomingInterviews.filter(c => {
    const parts = c.date_entretien.includes('/') ? c.date_entretien.split('/').reverse() : c.date_entretien.split('-');
    const d = new Date(parts.join('-')); d.setHours(0,0,0,0);
    return d >= tomorrow && d < tomorrowEnd;
  });
  if (tmInterviews.length > 0) {
    try {
      new Notification('🎯 Entretien demain !', {
        body: `Tu as ${tmInterviews.length} entretien(s) demain : ${tmInterviews.map(c => c.entreprise).join(', ')}`,
        icon: '/favicon.ico',
        tag: 'interview-reminder',
      });
      localStorage.setItem('last_interview_notif', todayStr);
    } catch (e) {}
  }
}

function calcStreak(list) {
  const days = new Set(
    list.filter(c => c.date_candidature).map(c => {
      const parts = c.date_candidature.includes('/') ? c.date_candidature.split('/').reverse() : c.date_candidature.split('-');
      return parts.join('-');
    })
  );
  const today = new Date(); today.setHours(0,0,0,0);
  const todayKey = today.toISOString().split('T')[0];
  // If today has a candidature, count from today; otherwise count from yesterday
  const startOffset = days.has(todayKey) ? 0 : 1;
  let streak = 0;
  for (let i = startOffset; i < 365; i++) {
    const d = new Date(today); d.setDate(today.getDate() - i);
    if (days.has(d.toISOString().split('T')[0])) streak++;
    else if (i > startOffset) break;
    else break;
  }
  return streak;
}

export default function Dashboard({ navigate }) {
  const [stats, setStats] = useState(null);
  const [allList, setAllList] = useState([]);
  const [relances, setRelances] = useState([]);
  const [upcomingInterviews, setUpcomingInterviews] = useState([]);
  const [weekCount, setWeekCount] = useState(0);
  const [weekHistory, setWeekHistory] = useState(getWeekHistory);
  const [objectif, setObjectif] = useState(() => Math.max(1, parseInt(localStorage.getItem('objectif_week') || '5')));
  const [editingObjectif, setEditingObjectif] = useState(false);
  const [objectifInput, setObjectifInput] = useState('');
  const { newAchievement } = useAchievements(allList);

  const userName = localStorage.getItem('user_name') || 'Yakup';
  const userFormation = localStorage.getItem('user_formation') || 'Mastère Infra & Cloud Xpert';
  const userTargetDate = localStorage.getItem('user_target_date') || '2026-10-01';

  useEffect(() => {
    api.get('/api/stats').then(setStats);
    api.get('/api/candidatures').then(all => {
      setAllList(all);
      const toRelance = all.filter(c => {
        if (!['Postulé','En attente'].includes(c.statut)) return false;
        const days = daysSince(c.date_candidature);
        return days !== null && days >= 7;
      }).sort((a,b) => daysSince(b.date_candidature) - daysSince(a.date_candidature)).slice(0,5);
      setRelances(toRelance);

      const now = new Date();
      const daysFromMonday = now.getDay() === 0 ? 6 : now.getDay() - 1;
      const wc = all.filter(c => {
        const d = daysSince(c.date_candidature);
        return d !== null && d >= 0 && d <= daysFromMonday;
      }).length;
      setWeekCount(wc);

      // Save current week to history
      const weekKey = getWeekKey(now);
      const stored = parseInt(localStorage.getItem(`week_hist_${weekKey}`) || '0');
      if (wc > stored) {
        localStorage.setItem(`week_hist_${weekKey}`, String(wc));
        setWeekHistory(getWeekHistory());
      }

      const todayMidnight = new Date(); todayMidnight.setHours(0,0,0,0);
      const in7 = new Date(todayMidnight); in7.setDate(in7.getDate() + 7);
      const upcoming = all.filter(c => {
        if (!c.date_entretien) return false;
        const parts = c.date_entretien.includes('/') ? c.date_entretien.split('/').reverse() : c.date_entretien.split('-');
        const d = new Date(parts.join('-')); d.setHours(0,0,0,0);
        return !isNaN(d) && d >= todayMidnight && d <= in7;
      }).sort((a,b) => a.date_entretien.localeCompare(b.date_entretien));
      setUpcomingInterviews(upcoming);
      checkNotifications(upcoming);
    });
  }, []);

  const saveObjectif = () => {
    const val = Math.max(1, parseInt(objectifInput) || objectif);
    setObjectif(val);
    localStorage.setItem('objectif_week', String(val));
    setEditingObjectif(false);
  };

  if (!stats) return <div className="loading"><div className="spinner" /></div>;

  const tauxReponse = stats.total > 0
    ? Math.round((stats.byStatut.filter(s => s.statut !== 'Postulé').reduce((a,b) => a + b.count, 0) / stats.total) * 100)
    : 0;

  const entretiens = stats.byStatut.find(s => s.statut === 'Entretien')?.count || 0;
  const enAttente = stats.byStatut.filter(s => ['En attente','En attente de réponse'].includes(s.statut)).reduce((a,b) => a + b.count, 0);
  const streak = calcStreak(allList);

  return (
    <>
      <DashboardInner stats={stats} tauxReponse={tauxReponse} entretiens={entretiens} enAttente={enAttente}
        streak={streak}
        relances={relances} upcomingInterviews={upcomingInterviews} weekCount={weekCount} weekHistory={weekHistory}
        objectif={objectif} editingObjectif={editingObjectif} objectifInput={objectifInput}
        setObjectifInput={setObjectifInput} setEditingObjectif={setEditingObjectif} saveObjectif={saveObjectif}
        navigate={navigate} userName={userName} formation={userFormation} targetDate={userTargetDate} />
      {newAchievement && (
        <div className="achievement-toast">
          <span className="achievement-icon">{newAchievement.icon}</span>
          <div>
            <div className="achievement-title">Succès débloqué !</div>
            <div className="achievement-name">{newAchievement.title}</div>
            <div className="achievement-desc">{newAchievement.desc}</div>
          </div>
        </div>
      )}
    </>
  );
}

function DashboardInner({ stats, tauxReponse, entretiens, enAttente, streak, relances, upcomingInterviews,
  weekCount, weekHistory, objectif, editingObjectif, objectifInput, setObjectifInput,
  setEditingObjectif, saveObjectif, navigate, userName, formation, targetDate }) {
  const animTotal = useCountUp(stats.total);
  const animTaux = useCountUp(tauxReponse);
  const animEntretiens = useCountUp(entretiens);
  const animEnAttente = useCountUp(enAttente);
  const animStreak = useCountUp(streak);

  return (
    <div className="dashboard">
      <div className="dash-header">
        <div>
          <h1 className="dash-title">Bonjour {userName} 👋</h1>
          <p className="dash-sub">{formation} — {new Date(targetDate).toLocaleDateString('fr-FR',{month:'long',year:'numeric'})}</p>
        </div>
        <button className="btn-primary" onClick={() => navigate('candidatures')}>+ Nouvelle candidature</button>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card kpi-main" onClick={() => navigate('candidatures')}>
          <div className="kpi-icon">📁</div>
          <div className="kpi-num">{animTotal}</div>
          <div className="kpi-label">Candidatures</div>
        </div>
        <div className="kpi-card" onClick={() => navigate('stats')}>
          <div className="kpi-icon">📈</div>
          <div className="kpi-num" style={{color:'var(--green)'}}>{animTaux}%</div>
          <div className="kpi-label">Taux de retour</div>
        </div>
        <div className="kpi-card" onClick={() => navigate('candidatures')}>
          <div className="kpi-icon">🎯</div>
          <div className="kpi-num" style={{color:'var(--accent)'}}>{animEntretiens}</div>
          <div className="kpi-label">Entretiens</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon">⏳</div>
          <div className="kpi-num" style={{color:'var(--orange)'}}>{animEnAttente}</div>
          <div className="kpi-label">En attente</div>
        </div>
        <div className="kpi-card" title="Jours consécutifs avec au moins une candidature">
          <div className="kpi-icon">🔥</div>
          <div className="kpi-num" style={{color:'#F97316'}}>{animStreak}</div>
          <div className="kpi-label">Jours de suite</div>
        </div>
      </div>

      <div className="dash-countdown-grid">
        <CountdownCard formation={formation} targetDate={targetDate} />
        <TipCard />
      </div>

      {/* OBJECTIF HEBDOMADAIRE */}
      {(() => {
        const r = 38, circ = 2 * Math.PI * r;
        const pct = Math.min(weekCount / objectif, 1);
        const isComplete = weekCount >= objectif;
        const strokeColor = isComplete ? 'var(--green)' : 'var(--accent)';
        return (
          <div className={`week-goal-card ${isComplete ? 'week-goal-complete' : ''}`}>
            <svg viewBox="0 0 100 100" className="week-goal-svg">
              <circle cx="50" cy="50" r={r} fill="none" stroke="var(--bg2)" strokeWidth="10" />
              <circle cx="50" cy="50" r={r} fill="none" stroke={strokeColor} strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${pct * circ} ${circ}`}
                strokeDashoffset={0}
                transform="rotate(-90 50 50)"
                style={{transition:'stroke-dasharray 0.9s cubic-bezier(0.34,1.56,0.64,1), stroke 0.4s'}}
              />
              <text x="50" y="46" textAnchor="middle" style={{fill:'var(--text)'}} fontSize="22" fontWeight="800" fontFamily="Space Grotesk">{weekCount}</text>
              <text x="50" y="62" textAnchor="middle" style={{fill:'var(--muted)'}} fontSize="9">/ {objectif}</text>
            </svg>
            <div className="week-goal-body">
              <div className="week-goal-title">Objectif de la semaine</div>
              <div className="week-goal-status">
                {isComplete
                  ? <span className="week-goal-ok">🎉 Objectif atteint !</span>
                  : <><span className="week-goal-remaining">{objectif - weekCount}</span> candidature{objectif - weekCount > 1 ? 's' : ''} restante{objectif - weekCount > 1 ? 's' : ''}</>
                }
              </div>
              <div className="week-goal-sub">{weekCount} envoyée{weekCount > 1 ? 's' : ''} cette semaine (lun → dim)</div>
              {editingObjectif ? (
                <div className="week-goal-edit-row">
                  <input
                    type="number" min="1" max="99"
                    value={objectifInput}
                    onChange={e => setObjectifInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveObjectif(); if (e.key === 'Escape') setEditingObjectif(false); }}
                    autoFocus className="week-goal-input"
                    placeholder="Ex: 5"
                  />
                  <button className="week-goal-confirm" onClick={saveObjectif}>✓</button>
                  <button className="week-goal-cancel-btn" onClick={() => setEditingObjectif(false)}>✕</button>
                </div>
              ) : (
                <button className="week-goal-edit-btn" onClick={() => { setObjectifInput(String(objectif)); setEditingObjectif(true); }}>
                  ✏️ Changer l'objectif
                </button>
              )}
            </div>
            <div className="week-goal-pct" style={{color: strokeColor}}>
              {Math.round(pct * 100)}%
            </div>
          </div>
        );
      })()}

      {/* SPARKLINE HISTORIQUE */}
      <WeekSparkline weekHistory={weekHistory} objectif={objectif} />

      {upcomingInterviews.length > 0 && (
        <div className="interview-alert">
          <div className="interview-alert-title">🎯 Entretiens à venir — {upcomingInterviews.length} dans les 7 prochains jours</div>
          <div className="interview-list">
            {upcomingInterviews.map(c => {
              const parts = c.date_entretien.includes('/') ? c.date_entretien.split('/').reverse() : c.date_entretien.split('-');
              const d = new Date(parts.join('-')); d.setHours(0,0,0,0);
              const today = new Date(); today.setHours(0,0,0,0);
              const days = Math.ceil((d - today) / 86400000);
              const label = days === 0 ? "Aujourd'hui !" : days === 1 ? 'Demain' : `Dans ${days} jours`;
              return (
                <div className="interview-item" key={c.id} onClick={() => navigate('detail', c.id)}>
                  <div className="interview-avatar">{c.entreprise[0]}</div>
                  <div style={{flex:1}}>
                    <div className="interview-entreprise">{c.entreprise}</div>
                    <div className="interview-days">{label} · 📅 {c.date_entretien}{c.poste ? ` · ${c.poste}` : ''}</div>
                  </div>
                  <span className="interview-arrow">→</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {relances.length > 0 && (
        <div className="relance-banner">
          <div className="relance-title">🔴 Relances urgentes — {relances.length} candidature{relances.length > 1 ? 's' : ''} sans réponse depuis +7 jours</div>
          <div className="relance-list">
            {relances.map(c => (
              <div className="relance-item" key={c.id} onClick={() => navigate('detail', c.id)}>
                <div className="relance-avatar">{c.entreprise[0]}</div>
                <div>
                  <div className="relance-entreprise">{c.entreprise}</div>
                  <div className="relance-days">Il y a {daysSince(c.date_candidature)} jours{c.localisation ? ` · ${c.localisation}` : ''}</div>
                </div>
                <span className="relance-arrow">→</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="dash-grid">
        <div className="card">
          <h2 className="card-title">Par statut</h2>
          <div className="statut-list">
            {Object.entries(STATUT_CONFIG).map(([statut, cfg]) => {
              const found = stats.byStatut.find(s => s.statut === statut);
              const count = found?.count || 0;
              const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
              return (
                <div className="statut-row" key={statut}>
                  <div className="statut-left">
                    <span>{cfg.emoji}</span>
                    <span className="statut-name">{statut}</span>
                  </div>
                  <div className="statut-bar-wrap">
                    <div className="statut-bar" style={{width:`${Math.max(pct,0.5)}%`, background: cfg.color}} />
                  </div>
                  <span className="statut-count" style={{color: count > 0 ? cfg.color : 'var(--muted)'}}>{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card">
          <h2 className="card-title">Dernières candidatures</h2>
          <div className="recent-list">
            {stats.recent.map(c => {
              const days = daysSince(c.date_candidature);
              const urgent = days !== null && days >= 7 && ['Postulé','En attente'].includes(c.statut);
              return (
                <div className={`recent-row ${urgent ? 'urgent' : ''}`} key={c.id} onClick={() => navigate('detail', c.id)}>
                  <div className="recent-avatar">{c.entreprise[0]}</div>
                  <div className="recent-info">
                    <div className="recent-entreprise">{c.entreprise}{urgent && <span className="urgent-dot">🔴</span>}</div>
                    <div className="recent-meta">{c.poste}{c.localisation ? ` · 📍${c.localisation}` : ''}</div>
                  </div>
                  <span className="badge" style={{background: STATUT_CONFIG[c.statut]?.color + '22', color: STATUT_CONFIG[c.statut]?.color}}>
                    {c.statut}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
