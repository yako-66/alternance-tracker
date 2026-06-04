const express = require('express');
const cors    = require('cors');
const path    = require('path');
const { getDb, query, run } = require('./database');

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client/build')));

// ── Ping ──────────────────────────────────────────────────────────────────────

app.get('/api/ping', (req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

// ── Waitlist (landing page) ───────────────────────────────────────────────────

const LANDING_ORIGIN = 'https://yako-66.github.io';

app.options('/api/waitlist', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', LANDING_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.sendStatus(204);
});

app.post('/api/waitlist', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', LANDING_ORIGIN);
  const { name, email, profile } = req.body;
  if (!email || !email.includes('@')) return res.status(400).json({ error: 'Email invalide' });
  try {
    await run('INSERT OR IGNORE INTO waitlist (name,email,profile,created_at) VALUES (?,?,?,?)',
      [name || '', email.toLowerCase().trim(), profile || '', new Date().toISOString()]);
    const rows = await query('SELECT COUNT(*) as c FROM waitlist');
    res.json({ success: true, count: rows[0].c });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/waitlist', async (req, res) => {
  try {
    const rows = await query('SELECT name,email,profile,created_at FROM waitlist ORDER BY id DESC');
    res.json({ count: rows.length, entries: rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Candidatures — stats (avant /:id) ────────────────────────────────────────

app.get('/api/candidatures/stats', async (req, res) => {
  try {
    const total      = Number((await query('SELECT COUNT(*) as c FROM candidatures WHERE archived=0'))[0].c);
    const byStatut   = await query('SELECT statut, COUNT(*) as count FROM candidatures WHERE archived=0 GROUP BY statut ORDER BY count DESC');
    const byLoc      = await query('SELECT localisation, COUNT(*) as count FROM candidatures WHERE archived=0 AND localisation!=\'\' GROUP BY localisation ORDER BY count DESC LIMIT 10');
    const bySec      = await query('SELECT secteur, COUNT(*) as count FROM candidatures WHERE archived=0 AND secteur!=\'\' GROUP BY secteur ORDER BY count DESC LIMIT 10');
    const history    = await query('SELECT substr(created_at,1,10) as day, COUNT(*) as count FROM candidatures WHERE archived=0 GROUP BY day ORDER BY day DESC LIMIT 30');
    const interviews = Number((await query('SELECT COUNT(*) as c FROM candidatures WHERE statut=\'Entretien\' AND archived=0'))[0].c);
    const pending    = Number((await query('SELECT COUNT(*) as c FROM candidatures WHERE date_rappel!=\'\' AND date_rappel IS NOT NULL AND statut NOT IN (\'Refus\',\'Sans suite\') AND archived=0'))[0].c);
    const recent     = await query('SELECT * FROM candidatures WHERE archived=0 ORDER BY id DESC LIMIT 5');
    res.json({ total, byStatut, byLoc, bySec, history, interviews, pending, recent });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Candidatures — CRUD ───────────────────────────────────────────────────────

app.get('/api/candidatures', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM candidatures ORDER BY id DESC');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/candidatures', async (req, res) => {
  const { entreprise, poste, source, date_candidature, contact, statut, notes, localisation, priorite, score, date_entretien, tags, salaire, secteur, taille, date_rappel } = req.body;
  if (!entreprise && !poste) return res.status(400).json({ error: 'Entreprise ou poste requis' });
  try {
    const result = await run(
      `INSERT INTO candidatures (entreprise,poste,source,date_candidature,contact,statut,notes,localisation,priorite,score,date_entretien,tags,salaire,secteur,taille,date_rappel)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [entreprise||'', poste||'', source||'', date_candidature||'', contact||'', statut||'Postulé', notes||'', localisation||'', priorite||0, score||0, date_entretien||'', tags||'', salaire||'', secteur||'', taille||'', date_rappel||'']
    );
    res.json((await query('SELECT * FROM candidatures WHERE id=?', [result.lastInsertRowid]))[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/candidatures/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const fields = ['entreprise','poste','source','date_candidature','contact','statut','notes','localisation','priorite','score','date_entretien','archived','tags','salaire','secteur','taille','date_rappel'];
  const updates = [], args = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) { updates.push(`${f}=?`); args.push(req.body[f]); }
  }
  if (!updates.length) return res.status(400).json({ error: 'Aucun champ valide' });
  args.push(id);
  try {
    await run(`UPDATE candidatures SET ${updates.join(',')} WHERE id=?`, args);
    res.json((await query('SELECT * FROM candidatures WHERE id=?', [id]))[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/candidatures/:id', async (req, res) => {
  try {
    await run('DELETE FROM candidatures WHERE id=?', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Échanges ──────────────────────────────────────────────────────────────────

app.post('/api/candidatures/:id/echanges', async (req, res) => {
  const { type, contenu, date } = req.body;
  try {
    const result = await run(
      'INSERT INTO echanges (candidature_id,type,contenu,date) VALUES (?,?,?,?)',
      [parseInt(req.params.id), type||'', contenu||'', date||'']
    );
    res.json({ id: result.lastInsertRowid, candidature_id: parseInt(req.params.id), type, contenu, date });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── SPA fallback ──────────────────────────────────────────────────────────────

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build/index.html'));
});

// ── Démarrage ─────────────────────────────────────────────────────────────────

getDb().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Serveur sur http://localhost:${PORT}`);
    const selfUrl = process.env.RENDER_EXTERNAL_URL;
    if (selfUrl) {
      setInterval(() => fetch(`${selfUrl}/api/ping`).catch(() => {}), 10 * 60 * 1000);
      console.log(`🏓 Keep-alive → ${selfUrl}/api/ping`);
    }
  });
}).catch(err => { console.error('❌ DB:', err); process.exit(1); });
