const express = require('express');
const cors = require('cors');
const path = require('path');
const { getDb, query, run } = require('./database');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client/build')));

app.use(async (req, res, next) => { await getDb(); next(); });

app.get('/api/candidatures', (req, res) => {
  res.json(query('SELECT * FROM candidatures ORDER BY id DESC', []));
});

app.post('/api/candidatures', (req, res) => {
  const { entreprise, poste, source, date_candidature, contact, statut, notes, localisation } = req.body;
  const result = run(
    'INSERT INTO candidatures (entreprise,poste,source,date_candidature,contact,statut,notes,localisation) VALUES (?,?,?,?,?,?,?,?)',
    [entreprise, poste||'', source||'', date_candidature||'', contact||'', statut||'Postulé', notes||'', localisation||'']
  );
  res.json(query('SELECT * FROM candidatures WHERE id = ?', [result.lastInsertRowid])[0]);
});

app.put('/api/candidatures/:id', (req, res) => {
  const { entreprise, poste, source, date_candidature, contact, statut, notes, localisation } = req.body;
  run(
    'UPDATE candidatures SET entreprise=?,poste=?,source=?,date_candidature=?,contact=?,statut=?,notes=?,localisation=? WHERE id=?',
    [entreprise, poste||'', source||'', date_candidature||'', contact||'', statut, notes||'', localisation||'', parseInt(req.params.id)]
  );
  res.json(query('SELECT * FROM candidatures WHERE id=?', [parseInt(req.params.id)])[0]);
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
