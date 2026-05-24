import React, { useState } from 'react';
import { api } from '../hooks/api';
import './Settings.css';

const DEFAULTS = {
  user_name: 'Yakup',
  user_formation: 'Mastère Infra & Cloud Xpert',
  user_target_date: '2026-10-01',
  user_city: 'Lyon',
};

function get(key) { return localStorage.getItem(key) || DEFAULTS[key]; }
function set(key, val) { localStorage.setItem(key, val); }

export default function Settings() {
  const [name, setName]         = useState(get('user_name'));
  const [formation, setFormation] = useState(get('user_formation'));
  const [targetDate, setTargetDate] = useState(get('user_target_date'));
  const [city, setCity]         = useState(get('user_city'));
  const [saved, setSaved]       = useState(false);
  const [importText, setImportText] = useState('');
  const [importStatus, setImportStatus] = useState('');

  const save = () => {
    set('user_name', name);
    set('user_formation', formation);
    set('user_target_date', targetDate);
    set('user_city', city);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const exportData = async () => {
    const cands = await api.get('/api/candidatures');
    const blob = new Blob([JSON.stringify(cands, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `alternance-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importCSV = async () => {
    if (!importText.trim()) return;
    const lines = importText.trim().split('\n');
    const header = lines[0].split(',').map(h => h.replace(/"/g,'').trim().toLowerCase());
    const map = {
      entreprise: header.findIndex(h => h.includes('entreprise') || h.includes('company')),
      poste: header.findIndex(h => h.includes('poste') || h.includes('position') || h.includes('job')),
      statut: header.findIndex(h => h.includes('statut') || h.includes('status')),
      localisation: header.findIndex(h => h.includes('localisation') || h.includes('ville') || h.includes('city')),
      source: header.findIndex(h => h.includes('source')),
      date_candidature: header.findIndex(h => h.includes('date')),
      notes: header.findIndex(h => h.includes('note')),
      contact: header.findIndex(h => h.includes('contact')),
    };
    let count = 0;
    for (const line of lines.slice(1)) {
      if (!line.trim()) continue;
      const cols = line.split(',').map(c => c.replace(/^"|"$/g,'').trim());
      const entreprise = map.entreprise >= 0 ? cols[map.entreprise] : '';
      if (!entreprise) continue;
      await api.post('/api/candidatures', {
        entreprise,
        poste: map.poste >= 0 ? cols[map.poste] : '',
        statut: map.statut >= 0 ? cols[map.statut] : 'Postulé',
        localisation: map.localisation >= 0 ? cols[map.localisation] : '',
        source: map.source >= 0 ? cols[map.source] : '',
        date_candidature: map.date_candidature >= 0 ? cols[map.date_candidature] : '',
        notes: map.notes >= 0 ? cols[map.notes] : '',
        contact: map.contact >= 0 ? cols[map.contact] : '',
      });
      count++;
    }
    setImportStatus(`✅ ${count} candidature${count > 1 ? 's' : ''} importée${count > 1 ? 's' : ''} !`);
    setImportText('');
    setTimeout(() => setImportStatus(''), 4000);
  };

  return (
    <div className="settings-page">
      <h1 className="page-title">⚙️ Paramètres</h1>

      <div className="settings-grid">
        {/* PROFIL */}
        <div className="settings-card">
          <h2 className="settings-section-title">👤 Mon profil</h2>
          <div className="settings-form">
            <div className="form-group">
              <label>Prénom affiché</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Ton prénom" />
            </div>
            <div className="form-group">
              <label>Formation visée</label>
              <input value={formation} onChange={e => setFormation(e.target.value)} placeholder="Ex: Mastère Infra & Cloud Xpert" />
            </div>
            <div className="form-group">
              <label>Date de rentrée cible</label>
              <input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Ville principale de recherche</label>
              <input value={city} onChange={e => setCity(e.target.value)} placeholder="Ex: Lyon" />
            </div>
            <button className={`btn-settings-save ${saved ? 'saved' : ''}`} onClick={save}>
              {saved ? '✅ Enregistré !' : '💾 Sauvegarder'}
            </button>
          </div>
        </div>

        {/* DONNÉES */}
        <div className="settings-card">
          <h2 className="settings-section-title">📦 Mes données</h2>
          <div className="settings-actions">
            <div className="settings-action-item">
              <div>
                <div className="settings-action-title">Exporter (JSON)</div>
                <div className="settings-action-desc">Télécharge toutes tes candidatures en JSON pour les sauvegarder.</div>
              </div>
              <button className="btn-settings-action" onClick={exportData}>⬇ Exporter</button>
            </div>
          </div>

          <div className="settings-import">
            <div className="settings-action-title" style={{marginBottom:10}}>📥 Importer un CSV</div>
            <div className="settings-action-desc" style={{marginBottom:12}}>
              Colle le contenu d'un fichier CSV. Colonnes reconnues : <code>entreprise, poste, statut, localisation, source, date, notes, contact</code>
            </div>
            <textarea
              className="import-textarea"
              value={importText}
              onChange={e => setImportText(e.target.value)}
              placeholder={'entreprise,poste,statut\n"CAPGEMINI","Alternant Cloud","Postulé"\n"SNCF","Alternant IT","En attente"'}
              rows={6}
            />
            <div style={{display:'flex',gap:10,alignItems:'center',marginTop:8}}>
              <button className="btn-settings-action" onClick={importCSV} disabled={!importText.trim()}>
                📥 Importer
              </button>
              {importStatus && <span className="import-status">{importStatus}</span>}
            </div>
          </div>
        </div>

        {/* RACCOURCIS */}
        <div className="settings-card settings-card-full">
          <h2 className="settings-section-title">⌨️ Raccourcis clavier</h2>
          <div className="shortcuts-grid">
            {[
              ['N', 'Nouvelle candidature'],
              ['/', 'Chercher une candidature'],
              ['Échap', 'Fermer la modal'],
              ['Entrée', 'Valider dans les champs'],
            ].map(([key, desc]) => (
              <div className="shortcut-row" key={key}>
                <kbd className="kbd">{key}</kbd>
                <span className="shortcut-desc">{desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
