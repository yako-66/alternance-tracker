import React, { useEffect, useRef, useState } from 'react';
import { api } from '../hooks/api';
import './Stats.css';

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
      const p = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setCount(parseFloat((startVal + eased * delta).toFixed(1)));
      if (p < 1) requestAnimationFrame(frame);
      else { setCount(target); prev.current = target; }
    };
    requestAnimationFrame(frame);
  }, [target, duration]);
  return count;
}

const STATUT_COLORS = {
  'Postulé':'#4ecdc4','En attente':'#ff9f43','En attente de réponse':'#ffd93d',
  'Entretien':'#00d4a0','Refus':'#ff6b6b','Sans suite':'#4a4a60'
};

export default function Stats() {
  const [list, setList] = useState([]);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get('/api/candidatures').then(setList);
    api.get('/api/stats').then(setStats);
  }, []);

  if (!stats) return <div className="loading"><div className="spinner" /></div>;

  // Stats par source
  const bySource = list.reduce((acc, c) => {
    const s = c.source || 'Non renseigné';
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});
  const sourcesSorted = Object.entries(bySource).sort((a,b) => b[1]-a[1]).slice(0,6);

  // Stats par localisation
  const byLoc = list.reduce((acc, c) => {
    const l = c.localisation || 'Non renseigné';
    acc[l] = (acc[l] || 0) + 1;
    return acc;
  }, {});
  const locSorted = Object.entries(byLoc).sort((a,b) => b[1]-a[1]).slice(0,6);

  // Taux conversion
  const entretiens = stats.byStatut.find(s => s.statut === 'Entretien')?.count || 0;
  const refus = stats.byStatut.find(s => s.statut === 'Refus')?.count || 0;
  const tauxEntretien = stats.total > 0 ? ((entretiens / stats.total) * 100).toFixed(1) : 0;
  const tauxRefus = stats.total > 0 ? ((refus / stats.total) * 100).toFixed(1) : 0;
  const tauxReponse = stats.total > 0
    ? (((stats.total - (stats.byStatut.find(s => s.statut === 'Postulé')?.count || 0)) / stats.total) * 100).toFixed(1)
    : 0;

  const maxSource = Math.max(...sourcesSorted.map(s => s[1]), 1);
  const maxLoc = Math.max(...locSorted.map(l => l[1]), 1);

  // Activité des 8 dernières semaines
  const now = new Date();
  const currentDayOfWeek = now.getDay() === 0 ? 7 : now.getDay();
  const daysFromMonday = currentDayOfWeek - 1;
  const weeklyData = Array.from({ length: 8 }, (_, i) => {
    const monday = new Date(now);
    monday.setDate(now.getDate() - daysFromMonday - (7 - i) * 7);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    const count = list.filter(c => {
      if (!c.date_candidature) return false;
      const parts = c.date_candidature.includes('/') ? c.date_candidature.split('/').reverse() : c.date_candidature.split('-');
      const d = new Date(parts.join('-'));
      return !isNaN(d) && d >= monday && d <= sunday;
    }).length;
    const isCurrent = i === 7;
    const label = `${String(monday.getDate()).padStart(2,'0')}/${String(monday.getMonth()+1).padStart(2,'0')}`;
    return { label, count, isCurrent };
  });
  const maxWeekly = Math.max(...weeklyData.map(w => w.count), 1);

  // Heatmap jours de la semaine
  const DAY_NAMES = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
  const byDay = [0,0,0,0,0,0,0];
  list.forEach(c => {
    if (!c.date_candidature) return;
    const parts = c.date_candidature.includes('/') ? c.date_candidature.split('/').reverse() : c.date_candidature.split('-');
    const d = new Date(parts.join('-'));
    if (!isNaN(d)) { const idx = d.getDay() === 0 ? 6 : d.getDay() - 1; byDay[idx]++; }
  });
  const maxDay = Math.max(...byDay, 1);

  // Score distribution
  const scoreDist = [5,4,3,2,1].map(s => ({
    star: s, count: list.filter(c => (c.score||0) === s).length
  }));
  const unratedCount = list.filter(c => !c.score || c.score === 0).length;
  const maxScoreDist = Math.max(...scoreDist.map(s => s.count), 1);

  // Temps moyen depuis candidature pour celles ayant reçu une réponse
  const responded = list.filter(c =>
    ['Entretien','Refus','Sans suite','En attente de réponse'].includes(c.statut) && c.date_candidature
  );
  const avgResponseDays = responded.length > 0
    ? Math.round(responded.reduce((acc, c) => {
        const parts = c.date_candidature.includes('/') ? c.date_candidature.split('/').reverse() : c.date_candidature.split('-');
        const d = new Date(parts.join('-'));
        return acc + Math.floor((Date.now() - d.getTime()) / 86400000);
      }, 0) / responded.length)
    : null;

  // Conversion par source (entretiens obtenus)
  const sourceConv = Object.entries(bySource).map(([source, total]) => {
    const interviews = list.filter(c => (c.source || 'Non renseigné') === source && c.statut === 'Entretien').length;
    return { source, total, interviews, rate: total > 0 ? ((interviews / total) * 100).toFixed(0) : 0 };
  }).sort((a, b) => b.interviews - a.interviews || b.total - a.total).slice(0, 6);

  // Prédiction — tendance des 4 dernières semaines actives
  const activeWeeks = weeklyData.filter(w => w.count > 0);
  const avgPerWeek = activeWeeks.length > 0
    ? activeWeeks.reduce((s, w) => s + w.count, 0) / activeWeeks.length
    : 0;
  const targetDate = new Date(localStorage.getItem('user_target_date') || '2026-10-01');
  const weeksLeft = Math.max(0, Math.ceil((targetDate - new Date()) / (7 * 24 * 3600 * 1000)));
  const projected = avgPerWeek > 0 ? Math.round(stats.total + avgPerWeek * weeksLeft) : null;

  return (
    <div className="stats-page">
      <h1 className="page-title">Statistiques 📈</h1>

      <div className="stats-kpi">
        <div className="stats-kpi-card">
          <div className="stats-kpi-num" style={{color:'var(--accent)'}}>{tauxReponse}%</div>
          <div className="stats-kpi-label">Taux de réponse</div>
          <div className="stats-kpi-sub">des entreprises ont répondu</div>
        </div>
        <div className="stats-kpi-card">
          <div className="stats-kpi-num" style={{color:'var(--green)'}}>{tauxEntretien}%</div>
          <div className="stats-kpi-label">Taux d'entretien</div>
          <div className="stats-kpi-sub">ont abouti en entretien</div>
        </div>
        <div className="stats-kpi-card">
          <div className="stats-kpi-num" style={{color:'var(--red)'}}>{tauxRefus}%</div>
          <div className="stats-kpi-label">Taux de refus</div>
          <div className="stats-kpi-sub">ont reçu un refus</div>
        </div>
        <div className="stats-kpi-card">
          <div className="stats-kpi-num" style={{color:'var(--yellow)'}}>{stats.total}</div>
          <div className="stats-kpi-label">Total candidatures</div>
          <div className="stats-kpi-sub">depuis le début</div>
        </div>
        <div className="stats-kpi-card">
          <div className="stats-kpi-num" style={{color:'var(--purple)'}}>{avgResponseDays !== null ? `${avgResponseDays}j` : '—'}</div>
          <div className="stats-kpi-label">Délai moyen</div>
          <div className="stats-kpi-sub">depuis la candidature ({responded.length} réponse{responded.length > 1 ? 's' : ''})</div>
        </div>
      </div>

      <div className="stats-grid">
        <div className="card">
          <h2 className="card-title">Répartition par statut</h2>
          <div className="donut-wrap">
            <svg viewBox="0 0 120 120" className="donut-svg">
              <g transform="rotate(-90 60 60)">
                {(() => {
                  let acc = 0;
                  const r = 45; const circ = 2 * Math.PI * r;
                  return stats.byStatut.filter(s => s.count > 0).map(s => {
                    const pct = s.count / stats.total;
                    const dash = pct * circ;
                    const dashOffset = -(acc * circ);
                    acc += pct;
                    return (
                      <circle key={s.statut} cx="60" cy="60" r={r}
                        fill="none" strokeWidth="18"
                        stroke={STATUT_COLORS[s.statut] || '#4a4a60'}
                        strokeDasharray={`${dash} ${circ - dash}`}
                        strokeDashoffset={dashOffset}
                        style={{transition:'all 0.5s'}}
                      />
                    );
                  });
                })()}
              </g>
              <text x="60" y="56" textAnchor="middle" style={{fill:'var(--text)'}} fontSize="18" fontWeight="800" fontFamily="Space Grotesk">{stats.total}</text>
              <text x="60" y="70" textAnchor="middle" style={{fill:'var(--muted)'}} fontSize="8">candidatures</text>
            </svg>
            <div className="donut-legend">
              {stats.byStatut.filter(s => s.count > 0).map(s => (
                <div className="legend-item" key={s.statut}>
                  <div className="legend-dot" style={{background: STATUT_COLORS[s.statut] || '#4a4a60'}} />
                  <span className="legend-label">{s.statut}</span>
                  <span className="legend-count">{s.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="card-title">Meilleures sources</h2>
          <div className="bar-chart">
            {sourcesSorted.map(([source, count]) => (
              <div className="bar-row" key={source}>
                <div className="bar-label">{source}</div>
                <div className="bar-wrap">
                  <div className="bar-fill" style={{width:`${(count/maxSource)*100}%`, background:'linear-gradient(90deg, var(--accent), var(--accent2))'}} />
                </div>
                <div className="bar-count">{count}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h2 className="card-title">Par localisation</h2>
          <div className="bar-chart">
            {locSorted.map(([loc, count]) => (
              <div className="bar-row" key={loc}>
                <div className="bar-label">{loc}</div>
                <div className="bar-wrap">
                  <div className="bar-fill" style={{width:`${(count/maxLoc)*100}%`, background:'linear-gradient(90deg, var(--green), var(--blue))'}} />
                </div>
                <div className="bar-count">{count}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h2 className="card-title">📅 Activité hebdomadaire</h2>
          <div className="weekly-chart">
            {weeklyData.map((w, i) => (
              <div className={`weekly-col ${w.isCurrent ? 'weekly-col-current' : ''}`} key={i}>
                {w.count > 0 && <div className="weekly-count-label">{w.count}</div>}
                <div className="weekly-bar-wrap">
                  <div
                    className="weekly-bar"
                    style={{height:`${Math.max((w.count / maxWeekly) * 100, w.count > 0 ? 8 : 0)}%`}}
                  />
                </div>
                <div className="weekly-label">{w.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h2 className="card-title">Entonnoir de conversion</h2>
          <div className="funnel">
            {[
              { label:'Candidatures envoyées', count:stats.total, color:'var(--accent)', pct:100 },
              { label:'Réponses reçues', count: stats.total - (stats.byStatut.find(s=>s.statut==='Postulé')?.count||0), color:'var(--blue)', pct: parseFloat(tauxReponse) },
              { label:'Entretiens', count: entretiens, color:'var(--green)', pct: parseFloat(tauxEntretien) },
            ].map((item, i) => (
              <div className="funnel-row" key={i}>
                <div className="funnel-bar-wrap">
                  <div className="funnel-bar" style={{width:`${item.pct}%`, background:item.color}} />
                </div>
                <div className="funnel-info">
                  <span className="funnel-label">{item.label}</span>
                  <span className="funnel-count" style={{color:item.color}}>{item.count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <h2 className="card-title">📆 Jours les plus actifs</h2>
          <div className="dayweek-chart">
            {DAY_NAMES.map((day, i) => {
              const count = byDay[i];
              const pct = (count / maxDay) * 100;
              const isTop = count === maxDay && count > 0;
              return (
                <div className={`dayweek-col ${isTop ? 'dayweek-top' : ''}`} key={day}>
                  {count > 0 && <div className="dayweek-count">{count}</div>}
                  <div className="dayweek-bar-wrap">
                    <div className="dayweek-bar" style={{height:`${Math.max(pct, count > 0 ? 10 : 0)}%`}} />
                  </div>
                  <div className="dayweek-label">{day}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card">
          <h2 className="card-title">🔄 Conversion par source</h2>
          {sourceConv.length === 0 ? (
            <p style={{color:'var(--muted)',fontSize:'0.85rem',textAlign:'center',padding:'24px 0'}}>Pas encore assez de données.</p>
          ) : (
            <div className="bar-chart">
              {sourceConv.map(({ source, total, interviews, rate }) => (
                <div className="bar-row" key={source}>
                  <div className="bar-label" title={source}>{source}</div>
                  <div className="bar-wrap">
                    <div className="bar-fill bar-fill-conv"
                      style={{width:`${Math.max((interviews / Math.max(...sourceConv.map(s => s.interviews), 1)) * 100, interviews > 0 ? 4 : 0)}%`}} />
                  </div>
                  <div className="bar-count">
                    <span>{interviews} 🎯</span>
                    <span style={{fontSize:'0.68rem',color:'var(--muted)',marginLeft:4}}>/ {total} ({rate}%)</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {projected !== null && (
          <div className="card stats-prediction-card">
            <h2 className="card-title">🔮 Projection</h2>
            <div className="prediction-body">
              <div className="prediction-num">{projected}</div>
              <div className="prediction-label">candidatures prévues d'ici le {targetDate.toLocaleDateString('fr-FR',{day:'numeric',month:'long'})}</div>
              <div className="prediction-sub">
                à ce rythme ({avgPerWeek.toFixed(1)}/semaine) sur {weeksLeft} semaine{weeksLeft > 1 ? 's' : ''} restante{weeksLeft > 1 ? 's' : ''}
              </div>
            </div>
          </div>
        )}

        <div className="card">
          <h2 className="card-title">⭐ Distribution des scores</h2>
          {scoreDist.every(s => s.count === 0) ? (
            <p style={{color:'var(--muted)',fontSize:'0.85rem',textAlign:'center',padding:'24px 0'}}>
              Note tes candidatures avec des étoiles pour voir la distribution ici.
            </p>
          ) : (
            <div className="score-dist">
              {scoreDist.map(({ star, count }) => (
                <div className="score-dist-row" key={star}>
                  <div className="score-dist-stars">{'★'.repeat(star)}{'☆'.repeat(5 - star)}</div>
                  <div className="score-dist-bar-wrap">
                    <div className="score-dist-bar" style={{width:`${(count / maxScoreDist) * 100}%`}} />
                  </div>
                  <div className="score-dist-count">{count}</div>
                </div>
              ))}
              {unratedCount > 0 && (
                <div className="score-dist-unrated">{unratedCount} non noté{unratedCount > 1 ? 'es' : 'e'}</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
