import React, { useEffect, useRef, useState } from 'react';
import { api } from '../hooks/api';
import { SOURCE_COLORS, SOURCE_LABELS } from '../App';
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

export default function MapGlobale({ navigate }) {
  const mapRef     = useRef(null);
  const leafletMap = useRef(null);
  const [offres,   setOffres]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [geocoded, setGeocoded] = useState(0);
  const [total,    setTotal]    = useState(0);

  useEffect(() => {
    api.get('/api/offres?limit=500').then(d => setOffres(d.offres || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!offres.length || !mapRef.current) return;

    const init = () => {
      if (!window.L) { setTimeout(init, 100); return; }
      if (leafletMap.current) { leafletMap.current.remove(); }

      const L   = window.L;
      const map = L.map(mapRef.current, { zoomControl: true, scrollWheelZoom: true });
      leafletMap.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors', maxZoom: 18,
      }).addTo(map);

      map.setView([45.75, 4.85], 8); // centré Lyon/Saint-Étienne

      // Grouper par localisation
      const byLoc = {};
      offres.forEach(o => {
        const loc = (o.localisation || '').split('(')[0].trim(); // "Lyon (69)" → "Lyon"
        if (!loc) return;
        if (!byLoc[loc]) byLoc[loc] = [];
        byLoc[loc].push(o);
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

          // Couleur par source dominante
          const srcCounts = {};
          items.forEach(o => { srcCounts[o.source] = (srcCounts[o.source] || 0) + 1; });
          const domSrc = Object.entries(srcCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'manual';
          const color  = SOURCE_COLORS[domSrc] || '#7c3aed';

          const icon = L.divIcon({
            className: '',
            html: `<div class="map-marker" style="background:${color};box-shadow:0 0 0 3px ${color}33,0 4px 12px rgba(0,0,0,.25)">${items.length}</div>`,
            iconSize: [36, 36], iconAnchor: [18, 18],
          });

          const popupHtml = items.slice(0, 5).map(o => `
            <div class="map-popup-item">
              <strong>${o.entreprise || o.titre}</strong><br/>
              <span style="color:${SOURCE_COLORS[o.source]||'#666'};font-size:11px;font-weight:600">${SOURCE_LABELS[o.source] || o.source}</span>
              <span style="font-size:11px;color:#888"> — ${o.titre.slice(0, 50)}</span>
            </div>
          `).join('<hr style="margin:5px 0;border-color:#eee"/>');

          const more = items.length > 5 ? `<div style="font-size:11px;color:#888;margin-top:6px">+${items.length - 5} autres</div>` : '';

          L.marker([coords.lat, coords.lon], { icon })
            .addTo(map)
            .bindPopup(`<div class="map-popup"><div class="map-popup-loc">📍 ${loc} · ${items.length} offre${items.length > 1 ? 's' : ''}</div>${popupHtml}${more}</div>`, { maxWidth: 280 })
            .on('click', () => navigate('offres'));
        }

        setLoading(false);
        if (bounds.length) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 11 });
      })();
    };

    init();
    return () => { if (leafletMap.current) { leafletMap.current.remove(); leafletMap.current = null; } };
  }, [offres]);

  // Compter par source pour la légende
  const bySrc = {};
  offres.forEach(o => { bySrc[o.source] = (bySrc[o.source] || 0) + 1; });

  return (
    <div className="map-globale-page">
      <h1 className="page-title">🗺️ Carte des offres</h1>

      {loading && offres.length > 0 && (
        <div className="map-loading-bar">
          <div className="map-loading-fill" style={{ width: `${total ? (geocoded / total) * 100 : 0}%` }} />
          <span className="map-loading-label">Géolocalisation… {geocoded}/{total}</span>
        </div>
      )}

      <div className="map-globale-layout">
        <div ref={mapRef} className="map-globale-container" />
        <div className="map-globale-legend">
          <div className="map-legend-title">Sources</div>
          {Object.entries(bySrc).map(([src, count]) => (
            <div className="map-legend-item" key={src}>
              <div className="map-legend-dot" style={{ background: SOURCE_COLORS[src] || '#666' }} />
              <span className="map-legend-label">{SOURCE_LABELS[src] || src}</span>
              <span className="map-legend-count" style={{ color: SOURCE_COLORS[src] || '#666' }}>{count}</span>
            </div>
          ))}
          <div className="map-legend-divider" />
          <div className="map-legend-total">{offres.length} offres · {Object.keys(bySrc).length} sources</div>
          <div className="map-legend-hint">Clique sur un marqueur pour filtrer</div>
        </div>
      </div>
    </div>
  );
}
