const { createClient } = require('@libsql/client');

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:./server/tracker.db',
  authToken: process.env.TURSO_AUTH_TOKEN || undefined,
});

async function getDb() {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS candidatures (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      entreprise       TEXT DEFAULT '',
      poste            TEXT DEFAULT '',
      source           TEXT DEFAULT '',
      date_candidature TEXT DEFAULT '',
      contact          TEXT DEFAULT '',
      statut           TEXT DEFAULT 'Postulé',
      notes            TEXT DEFAULT '',
      localisation     TEXT DEFAULT '',
      priorite         INTEGER DEFAULT 0,
      score            INTEGER DEFAULT 0,
      date_entretien   TEXT DEFAULT '',
      archived         INTEGER DEFAULT 0,
      tags             TEXT DEFAULT '',
      salaire          TEXT DEFAULT '',
      secteur          TEXT DEFAULT '',
      taille           TEXT DEFAULT '',
      date_rappel      TEXT DEFAULT '',
      created_at       TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS echanges (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      candidature_id   INTEGER NOT NULL,
      type             TEXT DEFAULT '',
      contenu          TEXT DEFAULT '',
      date             TEXT DEFAULT '',
      created_at       TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS waitlist (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT,
      email      TEXT UNIQUE NOT NULL,
      profile    TEXT,
      created_at TEXT
    )
  `);

  return client;
}

async function query(sql, params = []) {
  const result = await client.execute({ sql, args: params });
  return result.rows.map(row => ({ ...row }));
}

async function run(sql, params = []) {
  const result = await client.execute({ sql, args: params });
  return { lastInsertRowid: Number(result.lastInsertRowid) };
}

module.exports = { getDb, query, run };
