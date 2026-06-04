import React, { useEffect, useRef, useState } from 'react';
import { api } from '../hooks/api';
import './MapGlobale.css';

const geoCache = new Map();

async function geocode(loc) {
  if (!loc) return null;
  const key = loc.trim();
  if (geoCache.has(key)) return geoCache.get(key);
  try {
    const q = key.toLowerCase().includes('france') ? key : `${key}, France`;
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&accept-language=fr`);
    if (!res.ok) { geoCache.set(key, null); return null; }
    const data = await res.json();
    const r = data[0] ? { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) } : null;
    geoCache.set(key, r);
    return r;
  } catch { return null; }
}

const STATUT_COLORS = {
  'Postulé':'#4ecdc4','En attente':'#ff9f43','En attente de réponse':'#ffd93d',
  'Entretien':'#00d4a0','Refus':'#ff6b6b','Sans suite':'#4a4a60'
};

export default function MapGlobale({ navigate }) {
  const mapRef     = useRef(null);
  const leafletMap = useRef(null);
  const [candidatures, setCandidatures] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [geocoded, setGeocoded] = useState(0);
  const [total,    setTotal]    = useState(0);

  useEffect(() => {
    api.get('/api/candidatures').then(d => setCandidatures(d || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!candidatures.length || !mapRef.current) return;

    const init = () => {
      if (!window.L) { setTimeout(init, 100); return; }
      if (leafletMap.current) { leafletMap.current.remove(); }

      const L   = window.L;
      const map = L.map(mapRef.current, { zoomControl: true, scrollWheelZoom: true });
      leafletMap.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors', maxZoom: 18,
      }).addTo(map);

      map.setView([45.75, 4.85], 8);

      const byLoc = {};
      candidatures.forEach(c => {
        const loc = (c.localisation || '').split('(')[0].trim();
        if (!loc) return;
        if (!byLoc[loc]) byLoc[loc] = [];
        byLoc[loc].push(c);
      });

      const locs = Object.keys(byLoc);
      setTotal(locs.length);
      setLoading(true);

      const bounds = [];
      let done = 0;

      (async () => {
        for (const loc of locs) {
          const coords = await geocode(loc);
          await new Promise(r => setTimeout(r, 350));
          done++;
          setGeocoded(done);
          if (!coords) continue;

          const items = byLoc[loc];
          bounds.push([coords.lat, coords.lon]);

          const statCounts = {};
          items.forEach(c => { statCounts[c.statut] = (statCounts[c.statut] || 0) + 1; });
          const domStat = Object.entries(statCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Postulé';
          const color   = STATUT_COLORS[domStat] || '#7c3aed';

          const icon = L.divIcon({
            className: '',
            html: `<div class="map-marker" style="background:${color};box-shadow:0 0 0 3px ${color}33,0 4px 12px rgba(0,0,0,.25)">${items.length}</div>`,
            iconSize: [36, 36], iconAnchor: [18, 18],
          });

          const popupHtml = items.slice(0, 5).map(c => `
            <div class="map-popup-item">
              <strong>${c.entreprise || c.poste}</strong><br/>
              <span style="color:${STATUT_COLORS[c.statut]||'#666'};font-size:11px;font-weight:600">${c.statut}</span>
              <span style="font-size:11px;color:#888"> — ${(c.poste||'').slice(0, 50)}</span>
            </div>
          `).join('<hr style="margin:5px 0;border-color:#eee"/>');

          const more = items.length > 5 ? `<div style="font-size:11px;color:#888;margin-top:6px">+${items.length - 5} autres</div>` : '';

          L.marker([coords.lat, coords.lon], { icon })
            .addTo(map)
            .bindPopup(`<div class="map-popup"><div class="map-popup-loc">📍 ${loc} · ${items.length} candidature${items.length > 1 ? 's' : ''}</div>${popupHtml}${more}</div>`, { maxWidth: 280 })
            .on('click', () => navigate('candidatures'));
        }

        setLoading(false);
        if (bounds.length) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 11 });
      })();
    };

    init();
    return () => { if (leafletMap.current) { leafletMap.current.remove(); leafletMap.current = null; } };
  }, [candidatures]);

  const byStat = {};
  candidatures.forEach(c => { byStat[c.statut] = (byStat[c.statut] || 0) + 1; });

  return (
    <div className="map-globale-page">
      <h1 className="page-title">🗺️ Carte des candidatures</h1>

      {loading && candidatures.length > 0 && (
        <div className="map-loading-bar">
          <div className="map-loading-fill" style={{ width: `${total ? (geocoded / total) * 100 : 0}%` }} />
          <span className="map-loading-label">Géolocalisation… {geocoded}/{total}</span>
        </div>
      )}

      <div className="map-globale-layout">
        <div ref={mapRef} className="map-globale-container" />
        <div className="map-globale-legend">
          <div className="map-legend-title">Statuts</div>
          {Object.entries(byStat).map(([stat, count]) => (
            <div className="map-legend-item" key={stat}>
              <div className="map-legend-dot" style={{ background: STATUT_COLORS[stat] || '#666' }} />
              <span className="map-legend-label">{stat}</span>
              <span className="map-legend-count" style={{ color: STATUT_COLORS[stat] || '#666' }}>{count}</span>
            </div>
          ))}
          <div className="map-legend-divider" />
          <div className="map-legend-total">{candidatures.length} candidature{candidatures.length > 1 ? 's' : ''} · {Object.keys(byStat).length} statut{Object.keys(byStat).length > 1 ? 's' : ''}</div>
          <div className="map-legend-hint">Clique sur un marqueur pour filtrer</div>
        </div>
      </div>
    </div>
  );
}
