const express = require('express');
const cors = require('cors');
const path = require('path');
const basicAuth = require('express-basic-auth');
const { getDb, query, run, save } = require('./database');

const app = express();
const PORT = process.env.PORT || 3001;

const APP_USER = process.env.APP_USER || 'yakup';
const APP_PASSWORD = process.env.APP_PASSWORD;

if (!APP_PASSWORD) {
  console.warn('⚠️  APP_PASSWORD non défini — authentification désactivée en local');
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client/build')));

if (APP_PASSWORD) {
  app.use(basicAuth({
    users: { [APP_USER]: APP_PASSWORD },
    challenge: true,
    realm: 'Alternance Tracker',
  }));
}

app.use(async (req, res, next) => { await getDb(); next(); });

app.get('/api/candidatures', (req, res) => {
  res.json(query('SELECT * FROM candidatures ORDER BY id DESC', []));
});

app.post('/api/candidatures', (req, res) => {
  const { entreprise, poste, source, date_candidature, contact, statut, notes, localisation, priorite, score, date_entretien, archived, tags } = req.body;
  const result = run(
    'INSERT INTO candidatures (entreprise,poste,source,date_candidature,contact,statut,notes,localisation,priorite,score,date_entretien,archived,tags) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
    [entreprise, poste||'', source||'', date_candidature||'', contact||'', statut||'Postulé', notes||'', localisation||'', priorite||0, score||0, date_entretien||'', archived||0, tags||'']
  );
  res.json(query('SELECT * FROM candidatures WHERE id = ?', [result.lastInsertRowid])[0]);
});

app.put('/api/candidatures/:id', (req, res) => {
  const cid = parseInt(req.params.id);
  const current = query('SELECT * FROM candidatures WHERE id=?', [cid])[0];
  const { entreprise, poste, source, date_candidature, contact, statut, notes, localisation, priorite, score, date_entretien, archived, tags } = req.body;
  run(
    'UPDATE candidatures SET entreprise=?,poste=?,source=?,date_candidature=?,contact=?,statut=?,notes=?,localisation=?,priorite=?,score=?,date_entretien=?,archived=?,tags=? WHERE id=?',
    [entreprise, poste||'', source||'', date_candidature||'', contact||'', statut, notes||'', localisation||'', priorite||0, score||0, date_entretien||'', archived||0, tags||'', cid]
  );
  if (current && current.statut !== statut) {
    run('INSERT INTO echanges (candidature_id,type,contenu,date) VALUES (?,?,?,?)',
      [cid, 'Changement de statut', `${current.statut} → ${statut}`, new Date().toISOString().split('T')[0]]
    );
  }
  res.json(query('SELECT * FROM candidatures WHERE id=?', [cid])[0]);
});

app.delete('/api/candidatures/:id', (req, res) => {
  run('DELETE FROM echanges WHERE candidature_id=?', [parseInt(req.params.id)]);
  run('DELETE FROM candidatures WHERE id=?', [parseInt(req.params.id)]);
  res.json({ success: true });
});

app.get('/api/candidatures/:id/echanges', (req, res) => {
  res.json(query('SELECT * FROM echanges WHERE candidature_id=? ORDER BY id DESC', [parseInt(req.params.id)]));
});

app.post('/api/candidatures/:id/echanges', (req, res) => {
  const { type, contenu, date } = req.body;
  const result = run(
    'INSERT INTO echanges (candidature_id,type,contenu,date) VALUES (?,?,?,?)',
    [parseInt(req.params.id), type, contenu, date||new Date().toISOString().split('T')[0]]
  );
  res.json(query('SELECT * FROM echanges WHERE id=?', [result.lastInsertRowid])[0]);
});

app.delete('/api/echanges/:id', (req, res) => {
  run('DELETE FROM echanges WHERE id=?', [parseInt(req.params.id)]);
  res.json({ success: true });
});

app.get('/api/backup', (req, res) => {
  const candidatures = query('SELECT * FROM candidatures ORDER BY id ASC', []);
  const echanges = query('SELECT * FROM echanges ORDER BY id ASC', []);
  res.json({ candidatures, echanges, exportedAt: new Date().toISOString() });
});

app.post('/api/restore', (req, res) => {
  const { candidatures = [], echanges = [] } = req.body;
  run('DELETE FROM echanges', []);
  run('DELETE FROM candidatures', []);
  for (const c of candidatures) {
    run('INSERT INTO candidatures (entreprise,poste,source,date_candidature,contact,statut,notes,localisation,priorite,score,date_entretien,archived,tags) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [c.entreprise, c.poste||'', c.source||'', c.date_candidature||'', c.contact||'', c.statut||'Postulé', c.notes||'', c.localisation||'', c.priorite||0, c.score||0, c.date_entretien||'', c.archived||0, c.tags||'']
    );
  }
  const newIds = query('SELECT id FROM candidatures ORDER BY id ASC', []).map(r => r.id);
  const oldIds = candidatures.map(c => c.id);
  for (const e of echanges) {
    const idx = oldIds.indexOf(e.candidature_id);
    const newCid = idx >= 0 && newIds[idx] ? newIds[idx] : e.candidature_id;
    run('INSERT INTO echanges (candidature_id,type,contenu,date) VALUES (?,?,?,?)',
      [newCid, e.type, e.contenu, e.date]
    );
  }
  res.json({ success: true, candidatures: candidatures.length, echanges: echanges.length });
});

app.delete('/api/reset', (req, res) => {
  run('DELETE FROM echanges', []);
  run('DELETE FROM candidatures', []);
  res.json({ success: true });
});

app.get('/api/stats', (req, res) => {
  const total = query('SELECT COUNT(*) as count FROM candidatures')[0]?.count || 0;
  const byStatut = query('SELECT statut, COUNT(*) as count FROM candidatures GROUP BY statut');
  const recent = query('SELECT * FROM candidatures ORDER BY id DESC LIMIT 5');
  res.json({ total, byStatut, recent });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build/index.html'));
});

app.listen(PORT, () => console.log(`🚀 Serveur sur http://localhost:${PORT}`));
