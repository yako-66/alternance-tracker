import React, { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../hooks/api';
import { SOURCE_COLORS, SOURCE_LABELS } from '../App';
import './Offres.css';

function SourceBadge({ source }) {
  const color = SOURCE_COLORS[source] || '#666';
  return (
    <span className="source-badge" style={{ background: color + '22', color }}>
      {SOURCE_LABELS[source] || source}
    </span>
  );
}

function ScoreBar({ score }) {
  if (!score) return null;
  const color = score >= 70 ? '#00d4a0' : score >= 40 ? '#ff9f43' : '#888';
  return (
    <div className="score-wrap" title={`Match profil : ${score}/100`}>
      <div className="score-bar" style={{ width: `${score}%`, background: color }} />
    </div>
  );
}

function daysSince(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  const diff = Math.floor((Date.now() - d) / 86400000);
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return 'Hier';
  if (diff < 7)  return `Il y a ${diff}j`;
  if (diff < 30) return `Il y a ${Math.floor(diff / 7)}sem`;
  return `Il y a ${Math.floor(diff / 30)}mois`;
}

function OffreCard({ offre, onFavori, onClick }) {
  return (
    <div className={`offre-card ${!offre.vu ? 'offre-new' : ''}`} onClick={() => onClick(offre.id)}>
      <div className="offre-card-top">
        <div className="offre-avatar">{(offre.entreprise?.[0] || offre.titre?.[0] || '?').toUpperCase()}</div>
        <div className="offre-info">
          <div className="offre-titre">{offre.titre}</div>
          <div className="offre-sub">
            {offre.entreprise   && <span>{offre.entreprise}</span>}
            {offre.localisation && <span>📍 {offre.localisation}</span>}
            {offre.salaire      && <span>💰 {offre.salaire}</span>}
          </div>
        </div>
        <button
          className={`fav-btn ${offre.favori ? 'on' : ''}`}
          onClick={e => { e.stopPropagation(); onFavori(offre); }}
          title={offre.favori ? 'Retirer des favoris' : 'Ajouter aux favoris'}
        >{offre.favori ? '❤️' : '🤍'}</button>
      </div>
      <div className="offre-card-bottom">
        <SourceBadge source={offre.source} />
        {offre.date_publi && <span className="offre-date">{daysSince(offre.date_publi)}</span>}
        {!offre.vu && <span className="offre-new-badge">Nouveau</span>}
        <div className="offre-spacer" />
        <ScoreBar score={offre.score_match} />
      </div>
    </div>
  );
}

function SkeletonCards() {
  return (
    <div className="offres-list">
      {[1,2,3,4,5,6].map(i => (
        <div key={i} className="offre-card skeleton-offre" style={{ animationDelay: `${i * 60}ms` }}>
          <div className="offre-card-top">
            <div className="skeleton skel-avatar" />
            <div className="offre-info">
              <div className="skeleton skel-line" style={{ width: '60%' }} />
              <div className="skeleton skel-line" style={{ width: '40%', height: '10px', marginTop: '6px' }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Offres({ navigate }) {
  const [offres,   setOffres]   = useState([]);
  const [total,    setTotal]    = useState(0);
  const [loading,  setLoading]  = useState(true);
  const [scraping, setScraping] = useState(false);
  const [toast,    setToast]    = useState('');
  const [filters,  setFilters]  = useState({ q: '', source: '', sort: 'date', favori: false });
  const debRef = useRef(null);

  const load = useCallback(async (f) => {
    setLoading(true);
    const p = new URLSearchParams();
    if (f.q)      p.set('q', f.q);
    if (f.source) p.set('source', f.source);
    p.set('sort', f.sort);
    if (f.favori) p.set('favori', '1');
    p.set('limit', '300');
    try {
      const data = await api.get(`/api/offres?${p}`);
      setOffres(data.offres || []);
      setTotal(data.total || 0);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { load(filters); }, []);

  const setFilter = (key, val) => {
    const f = { ...filters, [key]: val };
    setFilters(f);
    if (key === 'q') {
      clearTimeout(debRef.current);
      debRef.current = setTimeout(() => load(f), 300);
    } else {
      load(f);
    }
  };

  const handleFavori = async (offre) => {
    const next = offre.favori ? 0 : 1;
    setOffres(prev => prev.map(o => o.id === offre.id ? { ...o, favori: next } : o));
    api.patch(`/api/offres/${offre.id}`, { favori: next }).catch(() => {
      setOffres(prev => prev.map(o => o.id === offre.id ? { ...o, favori: offre.favori } : o));
    });
  };

  const handleScrape = async () => {
    setScraping(true);
    setToast('');
    try {
      await api.post('/api/scrape', {});
      setToast('Scraping lancé en arrière-plan (cela prend ~30s)…');
      setTimeout(() => { load(filters); setScraping(false); }, 35000);
    } catch { setScraping(false); }
  };

  return (
    <div className="offres-page">
      <div className="offres-header">
        <div className="offres-titlerow">
          <h1 className="page-title">Offres d'alternance</h1>
          <button className={`scrape-btn ${scraping ? 'scraping' : ''}`} onClick={handleScrape} disabled={scraping}>
            {scraping ? '⏳ En cours…' : '🔄 Rafraîchir'}
          </button>
        </div>
        {toast && <div className="scrape-toast">{toast}</div>}

        <div className="filters-bar">
          <input
            className="filter-q"
            placeholder="🔍 Titre, entreprise, ville…"
            value={filters.q}
            onChange={e => setFilter('q', e.target.value)}
          />
          <select className="filter-sel" value={filters.source} onChange={e => setFilter('source', e.target.value)}>
            <option value="">Toutes sources</option>
            <option value="france_travail">France Travail</option>
            <option value="bonne_alternance">La Bonne Alternance</option>
            <option value="hellowork">HelloWork</option>
            <option value="manual">Manuel</option>
          </select>
          <select className="filter-sel" value={filters.sort} onChange={e => setFilter('sort', e.target.value)}>
            <option value="date">Plus récentes</option>
            <option value="score">Meilleur match</option>
            <option value="entreprise">Entreprise A-Z</option>
          </select>
          <label className="filter-fav">
            <input type="checkbox" checked={filters.favori} onChange={e => setFilter('favori', e.target.checked)} />
            Favoris
          </label>
        </div>
        <div className="offres-count">
          {loading ? '…' : `${offres.length} offre${offres.length !== 1 ? 's' : ''}${total > offres.length ? ` sur ${total}` : ''}`}
        </div>
      </div>

      {loading ? <SkeletonCards /> : offres.length === 0 ? (
        <div className="offres-empty">
          <div className="empty-icon">📭</div>
          <p>Aucune offre trouvée.</p>
          {!filters.q && !filters.source && (
            <button className="scrape-btn" onClick={handleScrape} disabled={scraping}>
              {scraping ? '⏳ En cours…' : '🔄 Lancer le scraping'}
            </button>
          )}
        </div>
      ) : (
        <div className="offres-list">
          {offres.map(o => (
            <OffreCard key={o.id} offre={o} onFavori={handleFavori} onClick={id => navigate('detail', id)} />
          ))}
        </div>
      )}
    </div>
  );
}
