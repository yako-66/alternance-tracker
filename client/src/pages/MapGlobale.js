import React, { useEffect, useRef, useState } from 'react';
import { api } from '../hooks/api';
import './MapGlobale.css';

const STATUT_COLORS = {
  'Postulé':'#4ecdc4','En attente':'#ff9f43','En attente de réponse':'#ffd93d',
  'Entretien':'#00d4a0','Refus':'#ff6b6b','Sans suite':'#4a4a60'
};

const geoCache = new Map();

async function geocode(loc) {
  if (!loc) return null;
  if (geoCache.has(loc)) return geoCache.get(loc);
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(loc + ', France')}&format=json&limit=1`
    );
    const data = await res.json();
    const result = data[0] ? { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) } : null;
    geoCache.set(loc, result);
    return result;
  } catch { return null; }
}

export default function MapGlobale({ navigate }) {
  const mapRef = useRef(null);
  const leafletMap = useRef(null);
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [geocoded, setGeocoded] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    api.get('/api/candidatures').then(setList);
  }, []);

  useEffect(() => {
    if (!list.length || !mapRef.current) return;

    // Attend que Leaflet soit dispo (CDN)
    const init = () => {
      if (!window.L) { setTimeout(init, 100); return; }
      if (leafletMap.current) { leafletMap.current.remove(); }

      const L = window.L;
      const map = L.map(mapRef.current, { zoomControl: true, scrollWheelZoom: true });
      leafletMap.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18,
      }).addTo(map);

      map.setView([46.2, 2.2], 6);

      const byLoc = {};
      list.forEach(c => {
        if (!c.localisation) return;
        if (!byLoc[c.localisation]) byLoc[c.localisation] = [];
        byLoc[c.localisation].push(c);
      });

      const locs = Object.keys(byLoc);
      setTotal(locs.length);
      setLoading(true);

      const bounds = [];
      let done = 0;

      const addMarkers = async () => {
        for (const loc of locs) {
          const coords = await geocode(loc);
          done++;
          setGeocoded(done);
          if (!coords) continue;

          const cands = byLoc[loc];
          bounds.push([coords.lat, coords.lon]);

          // Crée un marqueur custom coloré par statut dominant
          const dominant = cands.sort((a,b) =>
            ['Entretien','En attente de réponse','En attente','Postulé','Refus','Sans suite']
              .indexOf(a.statut) - ['Entretien','En attente de réponse','En attente','Postulé','Refus','Sans suite'].indexOf(b.statut)
          )[0].statut;
          const color = STATUT_COLORS[dominant] || '#9a9aa8';

          const icon = L.divIcon({
            className: '',
            html: `<div class="map-marker" style="background:${color};box-shadow:0 0 0 3px ${color}33,0 4px 12px rgba(0,0,0,0.25)">${cands.length}</div>`,
            iconSize: [36, 36],
            iconAnchor: [18, 18],
          });

          const popup = cands.map(c => `
            <div class="map-popup-item">
              <strong>${c.entreprise}</strong><br/>
              <span style="color:${STATUT_COLORS[c.statut]};font-size:11px;font-weight:600">${c.statut}</span>
              ${c.poste ? `<br/><span style="font-size:11px;color:#666">${c.poste}</span>` : ''}
            </div>
          `).join('<hr style="margin:6px 0;border-color:#eee"/>');

          L.marker([coords.lat, coords.lon], { icon })
            .addTo(map)
            .bindPopup(`<div class="map-popup"><div class="map-popup-loc">📍 ${loc} · ${cands.length} candidature${cands.length>1?'s':''}</div>${popup}</div>`, { maxWidth: 260 });
        }

        setLoading(false);
        if (bounds.length > 0) {
          map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
        }
      };

      addMarkers();
    };

    init();
    return () => { if (leafletMap.current) { leafletMap.current.remove(); leafletMap.current = null; } };
  }, [list]);

  const byStatut = {};
  list.forEach(c => { byStatut[c.statut] = (byStatut[c.statut] || 0) + 1; });

  return (
    <div className="map-globale-page">
      <h1 className="page-title">🗺️ Carte des candidatures</h1>

      {loading && list.length > 0 && (
        <div className="map-loading-bar">
          <div className="map-loading-fill" style={{width:`${total ? (geocoded/total)*100 : 0}%`}} />
          <span className="map-loading-label">Géolocalisation… {geocoded}/{total}</span>
        </div>
      )}

      <div className="map-globale-layout">
        <div ref={mapRef} className="map-globale-container" />

        <div className="map-globale-legend">
          <div className="map-legend-title">Légende</div>
          {Object.entries(STATUT_COLORS).map(([statut, color]) => {
            const count = byStatut[statut] || 0;
            return (
              <div className="map-legend-item" key={statut}>
                <div className="map-legend-dot" style={{background:color}} />
                <span className="map-legend-label">{statut}</span>
                <span className="map-legend-count" style={{color}}>{count}</span>
              </div>
            );
          })}
          <div className="map-legend-divider" />
          <div className="map-legend-total">{list.length} candidatures · {Object.keys(byStatut).length ? Object.values(byStatut).reduce((a,b)=>a+b,0) : 0} villes</div>
          <div className="map-legend-hint">Clique sur un marqueur pour voir les candidatures</div>
        </div>
      </div>
    </div>
  );
}
