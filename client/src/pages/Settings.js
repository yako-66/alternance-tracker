import React, { useState, useRef } from 'react';
import { api } from '../hooks/api';
import { ACHIEVEMENTS } from '../hooks/useAchievements';
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
  const [restoreStatus, setRestoreStatus] = useState('');
  const [resetStatus, setResetStatus] = useState('');
  const [notifPerm, setNotifPerm] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'denied');
  const [accentColor, setAccentColor] = useState(() => localStorage.getItem('accent_color') || '#7C3AED');
  const [toast, setToast] = useState('');
  const restoreRef = useRef(null);

  const unlockedIds = JSON.parse(localStorage.getItem('achievements') || '[]');

  const applyAccent = (color) => {
    setAccentColor(color);
    localStorage.setItem('accent_color', color);
    document.documentElement.style.setProperty('--purple', color);
    showToast('🎨 Couleur appliquée !');
  };

  const resetAccent = () => {
    const def = '#7C3AED';
    setAccentColor(def);
    localStorage.removeItem('accent_color');
    document.documentElement.style.removeProperty('--purple');
    showToast('🎨 Couleur réinitialisée');
  };

  const exportPDF = () => {
    showToast('🖨️ Ouverture impression…');
    setTimeout(() => window.print(), 300);
  };

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  const save = () => {
    set('user_name', name);
    set('user_formation', formation);
    set('user_target_date', targetDate);
    set('user_city', city);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  // Export complet (candidatures + échanges)
  const exportData = async () => {
    try {
      const data = await api.get('/api/backup');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `alternance-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(`✅ Backup complet exporté (${data.candidatures.length} candidatures, ${data.echanges.length} échanges)`);
    } catch {
      showToast('❌ Erreur lors de l\'export');
    }
  };

  // Restore depuis fichier JSON
  const handleRestoreFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const payload = Array.isArray(data)
        ? { candidatures: data, echanges: [] }
        : data;
      if (!payload.candidatures?.length) {
        setRestoreStatus('❌ Fichier invalide ou vide');
        return;
      }
      if (!window.confirm(`Restaurer ${payload.candidatures.length} candidatures et ${payload.echanges?.length || 0} échanges ?\n\nATTENTION : toutes les données actuelles seront remplacées.`)) {
        e.target.value = '';
        return;
      }
      const result = await api.post('/api/restore', payload);
      setRestoreStatus(`✅ Restauré : ${result.candidatures} candidatures, ${result.echanges} échanges`);
      setTimeout(() => setRestoreStatus(''), 5000);
    } catch {
      setRestoreStatus('❌ Fichier invalide');
    }
    e.target.value = '';
  };

  // Import CSV
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

  // Notifications
  const requestNotif = async () => {
    if (typeof Notification === 'undefined') {
      showToast('❌ Notifications non supportées dans ce navigateur');
      return;
    }
    const result = await Notification.requestPermission();
    setNotifPerm(result);
    if (result === 'granted') showToast('✅ Notifications activées ! Tu seras alerté J-1 avant chaque entretien.');
    else showToast('❌ Permission refusée — vérifie les paramètres de ton navigateur');
  };

  const testNotif = () => {
    try {
      new Notification('🎯 Test — AlternanceTracker', {
        body: 'Les notifications fonctionnent correctement !',
        icon: '/favicon.ico',
      });
    } catch { showToast('❌ Erreur lors du test'); }
  };

  // Reset toutes les données
  const resetAll = async () => {
    if (!window.confirm('ATTENTION : supprimer TOUTES les candidatures et échanges ?\n\nCette action est irréversible.')) return;
    if (!window.confirm('Confirme une deuxième fois — TOUTES les données seront perdues.')) return;
    await api.delete('/api/reset');
    setResetStatus('✅ Toutes les données supprimées');
    showToast('🗑️ Données réinitialisées');
    setTimeout(() => setResetStatus(''), 4000);
  };

  // Effacer l'historique hebdomadaire
  const clearWeekHistory = () => {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('week_hist_'));
    keys.forEach(k => localStorage.removeItem(k));
    localStorage.removeItem('last_interview_notif');
    showToast('✅ Historique hebdomadaire effacé');
  };

  const notifLabel = notifPerm === 'granted' ? '✅ Activées' : notifPerm === 'denied' ? '❌ Bloquées' : '⚠️ Non demandées';
  const notifColor = notifPerm === 'granted' ? 'var(--green)' : notifPerm === 'denied' ? 'var(--red)' : 'var(--orange)';

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

        {/* NOTIFICATIONS */}
        <div className="settings-card">
          <h2 className="settings-section-title">🔔 Notifications</h2>
          <div className="settings-actions">
            <div className="settings-action-item">
              <div>
                <div className="settings-action-title">Statut</div>
                <div className="settings-action-desc" style={{color: notifColor, fontWeight:600}}>{notifLabel}</div>
                <div className="settings-action-desc" style={{marginTop:4}}>
                  Reçois une notification la veille de chaque entretien planifié.
                </div>
              </div>
              {notifPerm !== 'granted' && (
                <button className="btn-settings-action btn-settings-action-green" onClick={requestNotif}>
                  🔔 Activer
                </button>
              )}
              {notifPerm === 'granted' && (
                <button className="btn-settings-action" onClick={testNotif}>
                  🧪 Tester
                </button>
              )}
            </div>
          </div>
        </div>

        {/* DONNÉES */}
        <div className="settings-card">
          <h2 className="settings-section-title">📦 Sauvegarde & Restauration</h2>
          <div className="settings-actions">
            <div className="settings-action-item">
              <div>
                <div className="settings-action-title">Exporter (JSON complet)</div>
                <div className="settings-action-desc">Télécharge toutes tes candidatures ET échanges en JSON.</div>
              </div>
              <button className="btn-settings-action" onClick={exportData}>⬇ Exporter</button>
            </div>

            <div className="settings-action-item">
              <div>
                <div className="settings-action-title">Restaurer depuis un backup</div>
                <div className="settings-action-desc">Importe un fichier JSON exporté depuis ce site. Remplace toutes les données actuelles.</div>
                {restoreStatus && <div className="settings-status" style={{marginTop:6}}>{restoreStatus}</div>}
              </div>
              <button className="btn-settings-action" onClick={() => restoreRef.current?.click()}>
                ⬆ Restaurer
              </button>
              <input ref={restoreRef} type="file" accept=".json" style={{display:'none'}} onChange={handleRestoreFile} />
            </div>
          </div>
        </div>

        {/* IMPORT CSV */}
        <div className="settings-card">
          <h2 className="settings-section-title">📥 Importer un CSV</h2>
          <div className="settings-import">
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

        {/* THÈME COULEUR */}
        <div className="settings-card">
          <h2 className="settings-section-title">🎨 Thème couleur</h2>
          <div className="settings-actions">
            <div className="settings-action-item">
              <div>
                <div className="settings-action-title">Couleur d'accent</div>
                <div className="settings-action-desc">Personnalise la couleur principale de l'interface.</div>
              </div>
              <div className="color-picker-wrap">
                <input type="color" className="color-input" value={accentColor} onChange={e => applyAccent(e.target.value)} title="Choisir une couleur" />
                <button className="btn-settings-action" onClick={resetAccent} title="Réinitialiser">↩ Réinit.</button>
              </div>
            </div>
            <div className="color-presets">
              {['#7C3AED','#2563EB','#059669','#DC2626','#D97706','#DB2777','#0891B2'].map(c => (
                <button key={c} className={`color-preset ${accentColor === c ? 'active' : ''}`}
                  style={{background:c}} onClick={() => applyAccent(c)} title={c} />
              ))}
            </div>
          </div>
        </div>

        {/* EXPORT PDF */}
        <div className="settings-card">
          <h2 className="settings-section-title">🖨️ Export & Impression</h2>
          <div className="settings-actions">
            <div className="settings-action-item">
              <div>
                <div className="settings-action-title">Imprimer / Exporter en PDF</div>
                <div className="settings-action-desc">Ouvre la fenêtre d'impression du navigateur. Choisis "Enregistrer en PDF" pour exporter.</div>
              </div>
              <button className="btn-settings-action" onClick={exportPDF}>🖨️ Imprimer</button>
            </div>
          </div>
        </div>

        {/* ACHIEVEMENTS */}
        <div className="settings-card settings-card-full">
          <h2 className="settings-section-title">🏆 Succès ({unlockedIds.length}/{ACHIEVEMENTS.length})</h2>
          <div className="achievements-grid">
            {ACHIEVEMENTS.map(a => {
              const unlocked = unlockedIds.includes(a.id);
              return (
                <div key={a.id} className={`achievement-badge ${unlocked ? 'achievement-unlocked' : 'achievement-locked'}`} title={a.desc}>
                  <div className="achievement-badge-icon">{a.icon}</div>
                  <div className="achievement-badge-title">{a.title}</div>
                  <div className="achievement-badge-desc">{a.desc}</div>
                  {!unlocked && <div className="achievement-lock">🔒</div>}
                </div>
              );
            })}
          </div>
        </div>

        {/* ZONE DANGER */}
        <div className="settings-card settings-card-danger">
          <h2 className="settings-section-title settings-danger-title">⚠️ Zone de danger</h2>
          <div className="settings-actions">
            <div className="settings-action-item">
              <div>
                <div className="settings-action-title">Effacer l'historique hebdomadaire</div>
                <div className="settings-action-desc">Remet à zéro le graphique de suivi hebdomadaire dans le Dashboard.</div>
              </div>
              <button className="btn-settings-action btn-settings-danger-light" onClick={clearWeekHistory}>
                🗑 Effacer
              </button>
            </div>
            <div className="settings-action-item">
              <div>
                <div className="settings-action-title">Supprimer toutes les données</div>
                <div className="settings-action-desc">Efface définitivement toutes les candidatures et échanges.</div>
                {resetStatus && <div className="settings-status" style={{marginTop:6,color:'var(--green)'}}>{resetStatus}</div>}
              </div>
              <button className="btn-settings-action btn-settings-danger" onClick={resetAll}>
                ⚠️ Tout supprimer
              </button>
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
              ['Ctrl+K', 'Recherche globale'],
              ['Échap', 'Fermer la modal / recherche'],
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

      {toast && <div className="settings-toast">{toast}</div>}
    </div>
  );
}
