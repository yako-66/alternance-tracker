const { createClient } = require('@libsql/client');

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:./server/tracker.db',
  authToken: process.env.TURSO_AUTH_TOKEN || undefined,
});

async function getDb() {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS offres (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      titre       TEXT NOT NULL,
      entreprise  TEXT DEFAULT '',
      localisation TEXT DEFAULT '',
      secteur     TEXT DEFAULT '',
      salaire     TEXT DEFAULT '',
      source      TEXT DEFAULT '',
      source_id   TEXT DEFAULT '',
      source_url  TEXT DEFAULT '',
      description TEXT DEFAULT '',
      date_publi  TEXT DEFAULT '',
      tags        TEXT DEFAULT '',
      score_match INTEGER DEFAULT 0,
      favori      INTEGER DEFAULT 0,
      vu          INTEGER DEFAULT 0,
      archived    INTEGER DEFAULT 0,
      note        TEXT DEFAULT '',
      created_at  TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(source, source_id)
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
