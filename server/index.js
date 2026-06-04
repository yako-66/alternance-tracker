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

// ── Stats ─────────────────────────────────────────────────────────────────────

app.get('/api/stats', async (req, res) => {
  try {
    const total   = Number((await query('SELECT COUNT(*) as count FROM candidatures WHERE archived=0'))[0].count);
    const byStatut = await query('SELECT statut, COUNT(*) as count FROM candidatures WHERE archived=0 GROUP BY statut ORDER BY count DESC');
    const recent  = await query('SELECT * FROM candidatures WHERE archived=0 ORDER BY id DESC LIMIT 5');
    res.json({ total, byStatut, recent });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Échanges ──────────────────────────────────────────────────────────────────

app.get('/api/candidatures/:id/echanges', async (req, res) => {
  try {
    res.json(await query('SELECT * FROM echanges WHERE candidature_id=? ORDER BY id DESC', [parseInt(req.params.id)]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/candidatures/:id/echanges', async (req, res) => {
  const { type, contenu, date } = req.body;
  try {
    const result = await run(
      'INSERT INTO echanges (candidature_id,type,contenu,date) VALUES (?,?,?,?)',
      [parseInt(req.params.id), type||'', contenu||'', date||new Date().toISOString().split('T')[0]]
    );
    res.json((await query('SELECT * FROM echanges WHERE id=?', [result.lastInsertRowid]))[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/echanges/:id', async (req, res) => {
  try {
    await run('DELETE FROM echanges WHERE id=?', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── AI (Groq) ─────────────────────────────────────────────────────────────────

async function callAI({ system, messages, max_tokens = 1024 }) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('GROQ_API_KEY non configuré');
  const msgs = [...(system ? [{ role: 'system', content: system }] : []), ...messages];
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: 'llama-3.1-8b-instant', messages: msgs, max_tokens }),
  });
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(`Groq ${res.status}: ${err?.error?.message || ''}`); }
  return (await res.json()).choices[0].message.content;
}

app.post('/api/ai/coach', async (req, res) => {
  const { messages, candidatures } = req.body;
  const ctx = (candidatures||[]).slice(0,30).map(c => `- ${c.entreprise} (${c.poste||'?'}) : ${c.statut}, ${c.localisation||''}`).join('\n') || '(aucune)';
  try {
    const content = await callAI({
      system: `Tu es un coach alternance. Candidatures de l'utilisateur :\n${ctx}\nRéponds en français, sois concis.`,
      messages: (messages||[]).filter(m => m.role !== 'assistant' || messages.indexOf(m) > 0),
    });
    res.json({ content });
  } catch (e) { res.status(503).json({ error: e.message }); }
});

app.post('/api/ai/parse', async (req, res) => {
  const { text } = req.body;
  try {
    const content = await callAI({
      system: 'Extrais les infos d\'une offre d\'emploi. Réponds UNIQUEMENT avec un JSON : {"entreprise":"","poste":"","localisation":"","salaire":"","secteur":"","description":"","date_publi":""}',
      messages: [{ role: 'user', content: text }],
    });
    const json = JSON.parse(content.match(/\{[\s\S]*\}/)?.[0] || '{}');
    res.json(json);
  } catch (e) { res.status(503).json({ error: e.message }); }
});

app.post('/api/ai/cover-letter', async (req, res) => {
  const { candidature } = req.body;
  try {
    const content = await callAI({
      system: 'Tu es expert en rédaction de lettres de motivation pour alternances en France. Rédige une lettre professionnelle, personnalisée, en français (max 300 mots).',
      messages: [{ role: 'user', content: `Entreprise: ${candidature?.entreprise}, Poste: ${candidature?.poste}, Notes: ${candidature?.notes||''}` }],
      max_tokens: 700,
    });
    res.json({ content });
  } catch (e) { res.status(503).json({ error: e.message }); }
});

app.post('/api/ai/interview', async (req, res) => {
  const { candidature } = req.body;
  try {
    const content = await callAI({
      system: 'Tu es coach entretien. Génère 5 questions d\'entretien avec conseils de réponse, pour un candidat en alternance.',
      messages: [{ role: 'user', content: `Poste: ${candidature?.poste}, Entreprise: ${candidature?.entreprise}, Secteur: ${candidature?.secteur||''}` }],
      max_tokens: 800,
    });
    res.json({ content });
  } catch (e) { res.status(503).json({ error: e.message }); }
});

app.post('/api/ai/import-url', async (req, res) => {
  const { url } = req.body;
  if (!url || !url.startsWith('http')) return res.status(400).json({ error: 'URL invalide' });
  try {
    const ctrl = new AbortController();
    const tid  = setTimeout(() => ctrl.abort(), 12000);
    const r    = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0' } });
    clearTimeout(tid);
    let text = (await r.text()).replace(/<script[\s\S]*?<\/script>/gi,'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim().slice(0, 6000);
    const content = await callAI({
      system: 'Extrais les infos d\'une offre d\'emploi. Réponds UNIQUEMENT avec un JSON : {"entreprise":"","poste":"","localisation":"","salaire":"","secteur":"","description":""}',
      messages: [{ role: 'user', content: text }],
    });
    const json = JSON.parse(content.match(/\{[\s\S]*\}/)?.[0] || '{}');
    res.json({ ...json, source_url: url });
  } catch (e) {
    res.status(503).json({ error: e.message.includes('aborted') ? 'Site inaccessible (timeout)' : e.message });
  }
});

// ── Backup / Restore / Reset ──────────────────────────────────────────────────

app.get('/api/backup', async (req, res) => {
  try {
    const candidatures = await query('SELECT * FROM candidatures ORDER BY id ASC');
    let echanges = [];
    if (candidatures.length) {
      const ph = candidatures.map(() => '?').join(',');
      echanges = await query(`SELECT * FROM echanges WHERE candidature_id IN (${ph}) ORDER BY id ASC`, candidatures.map(c => c.id));
    }
    res.json({ candidatures, echanges, exportedAt: new Date().toISOString() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/restore', async (req, res) => {
  const { candidatures = [], echanges = [] } = req.body;
  try {
    const existing = await query('SELECT id FROM candidatures');
    if (existing.length) {
      const ph = existing.map(() => '?').join(',');
      await run(`DELETE FROM echanges WHERE candidature_id IN (${ph})`, existing.map(c => c.id));
    }
    await run('DELETE FROM candidatures');
    for (const c of candidatures) {
      await run(
        'INSERT INTO candidatures (entreprise,poste,source,date_candidature,contact,statut,notes,localisation,priorite,score,date_entretien,archived,tags,salaire,secteur,taille,date_rappel) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [c.entreprise||'', c.poste||'', c.source||'', c.date_candidature||'', c.contact||'',
         c.statut||'Postulé', c.notes||'', c.localisation||'', c.priorite||0, c.score||0,
         c.date_entretien||'', c.archived||0, c.tags||'', c.salaire||'', c.secteur||'',
         c.taille||'', c.date_rappel||'']
      );
    }
    const newRows = await query('SELECT id FROM candidatures ORDER BY id ASC');
    const oldIds  = candidatures.map(c => c.id);
    for (const e of echanges) {
      const idx = oldIds.indexOf(e.candidature_id);
      const cid = idx >= 0 && newRows[idx] ? newRows[idx].id : e.candidature_id;
      await run('INSERT INTO echanges (candidature_id,type,contenu,date) VALUES (?,?,?,?)', [cid, e.type||'', e.contenu||'', e.date||'']);
    }
    res.json({ success: true, candidatures: candidatures.length, echanges: echanges.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/reset', async (req, res) => {
  try {
    const ids = (await query('SELECT id FROM candidatures')).map(c => c.id);
    if (ids.length) {
      await run(`DELETE FROM echanges WHERE candidature_id IN (${ids.map(() => '?').join(',')})`, ids);
    }
    await run('DELETE FROM candidatures');
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Partage public ────────────────────────────────────────────────────────────

const crypto = require('crypto');

app.post('/api/share', async (req, res) => {
  try {
    const token = crypto.randomBytes(16).toString('hex');
    await run('INSERT OR REPLACE INTO shares (token,created_at) VALUES (?,?)', [token, new Date().toISOString()]);
    res.json({ token });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/share', async (req, res) => {
  try { await run('DELETE FROM shares'); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/public/:token', async (req, res) => {
  try {
    const share = (await query('SELECT * FROM shares WHERE token=?', [req.params.token]))[0];
    if (!share) return res.status(404).json({ error: 'Lien invalide ou expiré' });
    const candidatures = await query('SELECT * FROM candidatures WHERE archived=0 ORDER BY id DESC');
    res.json({ candidatures });
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
