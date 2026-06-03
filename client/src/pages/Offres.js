import React, { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../hooks/api';
import { SOURCE_COLORS, SOURCE_LABELS } from '../App';
import './Offres.css';

function daysSince(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  const diff = Math.floor((Date.now() - d) / 86400000);
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return 'Hier';
  if (diff < 7)  return `${diff}j`;
  if (diff < 30) return `${Math.floor(diff / 7)}sem`;
  return `${Math.floor(diff / 30)}mois`;
}

function MatchPill({ score }) {
  if (!score) return null;
  const color = score >= 70 ? '#10B981' : score >= 40 ? '#F59E0B' : '#94A3B8';
  const bg    = score >= 70 ? '#ECFDF5' : score >= 40 ? '#FFFBEB' : '#F1F5F9';
  return (
    <span className="match-pill" style={{ color, background: bg }}>
      {score}% match
    </span>
  );
}

function OffreCard({ offre, onFavori, onNavigate }) {
  const srcColor = SOURCE_COLORS[offre.source] || '#94A3B8';
  const isNew    = !offre.vu;

  return (
    <div className={`ocard ${isNew ? 'ocard-new' : ''}`} onClick={() => onNavigate(offre.id)}>
      {isNew && <div className="ocard-new-dot" />}

      <div className="ocard-top">
        <div className="ocard-avatar" style={{ background: srcColor + '22', color: srcColor }}>
          {(offre.entreprise?.[0] || offre.titre?.[0] || '?').toUpperCase()}
        </div>
        <div className="ocard-body">
          <div className="ocard-titre">{offre.titre}</div>
          <div className="ocard-meta">
            {offre.entreprise && <span className="ocard-company">{offre.entreprise}</span>}
            {offre.localisation && <span>📍 {offre.localisation.split(',')[0]}</span>}
          </div>
        </div>
        <button
          className={`ocard-fav ${offre.favori ? 'on' : ''}`}
          onClick={e => { e.stopPropagation(); onFavori(offre); }}
        >
          {offre.favori ? '❤️' : '🤍'}
        </button>
      </div>

      <div className="ocard-bottom">
        <span className="ocard-src" style={{ color: srcColor, background: srcColor + '15' }}>
          {SOURCE_LABELS[offre.source] || offre.source}
        </span>
        {offre.salaire && <span className="ocard-sal">💰 {offre.salaire}</span>}
        {offre.date_publi && <span className="ocard-date">{daysSince(offre.date_publi)}</span>}
        <div style={{ flex: 1 }} />
        <MatchPill score={offre.score_match} />
        {offre.source_url && (
          <a
            className="ocard-apply"
            href={offre.source_url}
            target="_blank" rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
          >
            Postuler →
          </a>
        )}
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="offres-list">
      {[1,2,3,4,5].map(i => (
        <div key={i} className="ocard-skel" style={{ animationDelay: `${i * 80}ms` }}>
          <div className="skel-avatar" />
          <div className="skel-lines">
            <div className="skel-line" style={{ width: '65%' }} />
            <div className="skel-line" style={{ width: '40%', height: '11px' }} />
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
  const [q,        setQ]        = useState('');
  const [source,   setSource]   = useState('');
  const [sort,     setSort]     = useState('score'); // meilleur match par défaut
  const [favsOnly, setFavsOnly] = useState(false);
  const debRef = useRef(null);

  const load = useCallback(async (params) => {
    setLoading(true);
    const p = new URLSearchParams();
    if (params.q)       p.set('q', params.q);
    if (params.source)  p.set('source', params.source);
    if (params.favsOnly) p.set('favori', '1');
    p.set('sort', params.sort || 'score');
    p.set('limit', '200');
    try {
      const data = await api.get(`/api/offres?${p}`);
      setOffres(data.offres || []);
      setTotal(data.total || 0);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load({ q, source, sort, favsOnly }); }, []);

  const update = (key, val) => {
    const next = { q, source, sort, favsOnly, [key]: val };
    if (key === 'q') {
      if (key === 'q') setQ(val);
      clearTimeout(debRef.current);
      debRef.current = setTimeout(() => load(next), 320);
    } else {
      if (key === 'source')   setSource(val);
      if (key === 'sort')     setSort(val);
      if (key === 'favsOnly') setFavsOnly(val);
      load(next);
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
    try {
      await api.post('/api/scrape', {});
      setToast('Scraping en cours (~30s)…');
      setTimeout(() => {
        load({ q, source, sort, favsOnly });
        setScraping(false);
        setToast('');
      }, 35000);
    } catch { setScraping(false); }
  };

  // Groupes : nouvelles d'abord, puis le reste
  const nouvelles = offres.filter(o => !o.vu);
  const vues      = offres.filter(o =>  o.vu);

  return (
    <div className="offres-page">
      {/* Header */}
      <div className="offres-hd">
        <div className="offres-hd-row">
          <h1 className="page-title">Offres</h1>
          <button className={`scrape-btn ${scraping ? 'spin' : ''}`} onClick={handleScrape} disabled={scraping} title="Rafraîchir">
            {scraping ? '⏳' : '🔄'}
          </button>
        </div>
        {toast && <div className="offres-toast">{toast}</div>}

        {/* Filtres */}
        <div className="filters">
          <input
            className="f-search"
            placeholder="🔍 Rechercher…"
            value={q}
            onChange={e => { setQ(e.target.value); update('q', e.target.value); }}
          />
          <div className="f-row">
            <select className="f-sel" value={source} onChange={e => update('source', e.target.value)}>
              <option value="">Toutes sources</option>
              <option value="adzuna">Adzuna</option>
              <option value="france_travail">France Travail</option>
              <option value="bonne_alternance">LBA</option>
              <option value="demo">Démo</option>
            </select>
            <select className="f-sel" value={sort} onChange={e => update('sort', e.target.value)}>
              <option value="score">⭐ Meilleur match</option>
              <option value="date">🕐 Plus récentes</option>
              <option value="entreprise">🏢 Entreprise A-Z</option>
            </select>
            <button
              className={`f-fav-btn ${favsOnly ? 'on' : ''}`}
              onClick={() => update('favsOnly', !favsOnly)}
            >
              {favsOnly ? '❤️' : '🤍'} Favoris
            </button>
          </div>
        </div>

        <div className="offres-count">
          {loading ? 'Chargement…' : `${offres.length} offre${offres.length > 1 ? 's' : ''}${nouvelles.length ? ` · ${nouvelles.length} nouvelles` : ''}`}
        </div>
      </div>

      {/* Contenu */}
      {loading ? <Skeleton /> : offres.length === 0 ? (
        <div className="offres-vide">
          <div className="vide-icon">📭</div>
          <p>{favsOnly ? 'Aucun favori encore.' : 'Aucune offre trouvée.'}</p>
          {!q && !source && !favsOnly && (
            <button className="scrape-btn lg" onClick={handleScrape} disabled={scraping}>
              {scraping ? '⏳ En cours…' : '🔄 Lancer le scraping'}
            </button>
          )}
        </div>
      ) : (
        <>
          {nouvelles.length > 0 && (
            <section>
              <div className="section-lbl">🆕 Nouvelles offres</div>
              <div className="offres-list">
                {nouvelles.map(o => (
                  <OffreCard key={o.id} offre={o} onFavori={handleFavori} onNavigate={id => navigate('detail', id)} />
                ))}
              </div>
            </section>
          )}
          {vues.length > 0 && (
            <section>
              {nouvelles.length > 0 && <div className="section-lbl">Déjà vues</div>}
              <div className="offres-list">
                {vues.map(o => (
                  <OffreCard key={o.id} offre={o} onFavori={handleFavori} onNavigate={id => navigate('detail', id)} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
