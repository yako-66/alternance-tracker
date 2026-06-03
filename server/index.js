const express = require('express');
const cors    = require('cors');
const path    = require('path');
const { getDb, query, run } = require('./database');
const { startCron, runScrapers, getScrapeStatus } = require('./cron');

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client/build')));

// ── Ping / keepalive ──────────────────────────────────────────────────────────

app.get('/api/ping', (req, res) => {
  res.json({ ok: true, ts: Date.now(), ...getScrapeStatus() });
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

// ── Offres — routes spécifiques AVANT /:id ───────────────────────────────────

app.get('/api/offres/stats', async (req, res) => {
  try {
    const total    = Number((await query('SELECT COUNT(*) as c FROM offres WHERE archived=0'))[0].c);
    const favoris  = Number((await query('SELECT COUNT(*) as c FROM offres WHERE favori=1 AND archived=0'))[0].c);
    const nouvelles = Number((await query('SELECT COUNT(*) as c FROM offres WHERE vu=0 AND archived=0'))[0].c);
    const bySrc    = await query('SELECT source, COUNT(*) as count FROM offres WHERE archived=0 GROUP BY source ORDER BY count DESC');
    const byLoc    = await query('SELECT localisation, COUNT(*) as count FROM offres WHERE archived=0 AND localisation!=\'\' GROUP BY localisation ORDER BY count DESC LIMIT 10');
    const bySec    = await query('SELECT secteur, COUNT(*) as count FROM offres WHERE archived=0 AND secteur!=\'\' GROUP BY secteur ORDER BY count DESC LIMIT 10');
    const recent   = await query('SELECT * FROM offres WHERE archived=0 ORDER BY score_match DESC, id DESC LIMIT 5');
    const history  = await query('SELECT substr(created_at,1,10) as day, COUNT(*) as count FROM offres WHERE archived=0 GROUP BY day ORDER BY day DESC LIMIT 30');
    res.json({ total, favoris, nouvelles, bySrc, byLoc, bySec, recent, history, ...getScrapeStatus() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/offres/import-url', async (req, res) => {
  const { url } = req.body;
  if (!url || !url.startsWith('http')) return res.status(400).json({ error: 'URL invalide' });
  try {
    const ctrl = new AbortController();
    const tid  = setTimeout(() => ctrl.abort(), 12000);
    const r    = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });
    clearTimeout(tid);
    let text = await r.text();
    text = text
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 6000);
    const key = process.env.GROQ_API_KEY;
    if (!key) return res.status(503).json({ error: 'GROQ_API_KEY non configuré' });
    const ai = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        max_tokens: 512,
        messages: [
          { role: 'system', content: 'Extrais les infos d\'une offre d\'emploi. Réponds UNIQUEMENT avec un JSON valide : {"titre":"","entreprise":"","localisation":"","salaire":"","secteur":"","description":"","date_publi":""}' },
          { role: 'user', content: text },
        ],
      }),
    });
    if (!ai.ok) throw new Error(`Groq ${ai.status}`);
    const aiData = await ai.json();
    const raw    = aiData.choices[0].message.content;
    const json   = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || '{}');
    res.json({ ...json, source_url: url, source: 'manual' });
  } catch (e) {
    res.status(503).json({ error: e.message.includes('aborted') ? 'Site inaccessible (timeout)' : e.message });
  }
});

// ── Offres — CRUD ─────────────────────────────────────────────────────────────

app.get('/api/offres', async (req, res) => {
  const { q, source, favori, sort = 'date', limit = 200, offset = 0 } = req.query;
  try {
    const where = ['archived=0'];
    const args  = [];

    if (q) {
      where.push('(titre LIKE ? OR entreprise LIKE ? OR localisation LIKE ? OR description LIKE ?)');
      const like = `%${q}%`;
      args.push(like, like, like, like);
    }
    if (source) { where.push('source=?'); args.push(source); }
    if (favori === '1') where.push('favori=1');

    const w = `WHERE ${where.join(' AND ')}`;
    const orderMap = {
      date:      'date_publi DESC, id DESC',
      score:     'score_match DESC, date_publi DESC',
      entreprise:'entreprise ASC',
    };
    const order = orderMap[sort] || orderMap.date;

    const offres    = await query(`SELECT * FROM offres ${w} ORDER BY ${order} LIMIT ? OFFSET ?`, [...args, parseInt(limit), parseInt(offset)]);
    const countRows = await query(`SELECT COUNT(*) as total FROM offres ${w}`, args);
    res.json({ offres, total: Number(countRows[0]?.total || 0) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/offres/:id', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM offres WHERE id=?', [parseInt(req.params.id)]);
    if (!rows[0]) return res.status(404).json({ error: 'Offre introuvable' });
    await run('UPDATE offres SET vu=1 WHERE id=?', [parseInt(req.params.id)]);
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/offres', async (req, res) => {
  const { titre, entreprise, localisation, secteur, salaire, source_url, description, date_publi, tags } = req.body;
  if (!titre) return res.status(400).json({ error: 'Titre requis' });
  try {
    const source_id = `manual_${Date.now()}`;
    const result    = await run(
      `INSERT INTO offres (titre,entreprise,localisation,secteur,salaire,source,source_id,source_url,description,date_publi,tags)
       VALUES (?,?,?,?,?,'manual',?,?,?,?,?)`,
      [titre, entreprise || '', localisation || '', secteur || '', salaire || '',
       source_id, source_url || '', description || '', date_publi || '', tags || '']
    );
    res.json((await query('SELECT * FROM offres WHERE id=?', [result.lastInsertRowid]))[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/offres/:id', async (req, res) => {
  const id      = parseInt(req.params.id);
  const allowed = ['favori', 'archived', 'note', 'score_match', 'vu'];
  const updates = [], args = [];
  for (const f of allowed) {
    if (req.body[f] !== undefined) { updates.push(`${f}=?`); args.push(req.body[f]); }
  }
  if (!updates.length) return res.status(400).json({ error: 'Aucun champ valide' });
  args.push(id);
  try {
    await run(`UPDATE offres SET ${updates.join(',')} WHERE id=?`, args);
    res.json((await query('SELECT * FROM offres WHERE id=?', [id]))[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/offres/:id', async (req, res) => {
  try {
    await run('DELETE FROM offres WHERE id=?', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Scraping manuel ───────────────────────────────────────────────────────────

app.post('/api/scrape', (req, res) => {
  runScrapers();
  res.json({ message: 'Scraping démarré en arrière-plan' });
});

// ── Suppression par source ────────────────────────────────────────────────────

app.delete('/api/offres/source/:source', async (req, res) => {
  try {
    await run('DELETE FROM offres WHERE source = ?', [req.params.source]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Debug France Travail (temporaire) ────────────────────────────────────────

app.get('/api/debug/ft', async (req, res) => {
  const id     = process.env.FRANCE_TRAVAIL_CLIENT_ID;
  const secret = process.env.FRANCE_TRAVAIL_CLIENT_SECRET;
  if (!id) return res.json({ error: 'Clés FT absentes' });

  try {
    // 1. Auth
    const body = new URLSearchParams({ grant_type:'client_credentials', client_id:id, client_secret:secret, scope:'api_offresdemploiv2 o2dsoffre' });
    const auth = await fetch('https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=/partenaire', { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body:body.toString() });
    const authData = await auth.json();
    if (!auth.ok) return res.json({ step:'auth', status:auth.status, error: authData });

    const token = authData.access_token;

    // 2. Search simple (sans commune, juste typeContrat)
    const url = new URL('https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search');
    url.searchParams.set('typeContrat','E2');
    url.searchParams.set('departement','69');
    url.searchParams.set('range','0-9');
    const search = await fetch(url.toString(), { headers:{ Authorization:`Bearer ${token}`, Accept:'application/json' } });
    const searchData = search.status === 204 ? { resultats:[] } : await search.json();
    res.json({ step:'search', status:search.status, total:searchData.resultats?.length || 0, sample:searchData.resultats?.[0]?.intitule || null, error: searchData.error || null });
  } catch(e) { res.json({ error: e.message }); }
});

// ── SPA fallback ──────────────────────────────────────────────────────────────

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build/index.html'));
});

// ── Démarrage ─────────────────────────────────────────────────────────────────

getDb().then(() => {
  startCron();
  app.listen(PORT, () => {
    console.log(`🚀 Serveur sur http://localhost:${PORT}`);
    const selfUrl = process.env.RENDER_EXTERNAL_URL;
    if (selfUrl) {
      setInterval(() => fetch(`${selfUrl}/api/ping`).catch(() => {}), 10 * 60 * 1000);
      console.log(`🏓 Keep-alive → ${selfUrl}/api/ping`);
    }
  });
}).catch(err => { console.error('❌ DB:', err); process.exit(1); });
