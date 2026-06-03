// API France Travail (ex-Pôle Emploi) — OAuth2 client_credentials
// Inscription gratuite : https://francetravail.io/data/api/offres-emploi
let cachedToken = null;
let tokenExpiry  = 0;

async function getToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
  const id     = process.env.FRANCE_TRAVAIL_CLIENT_ID;
  const secret = process.env.FRANCE_TRAVAIL_CLIENT_SECRET;
  if (!id || !secret) throw new Error('FRANCE_TRAVAIL_CLIENT_ID/SECRET absents');

  const body = new URLSearchParams({
    grant_type:    'client_credentials',
    client_id:     id,
    client_secret: secret,
    scope:         'api_offresdemploiv2 o2dsoffre',
  });
  const res = await fetch(
    'https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=/partenaire',
    { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() }
  );
  if (!res.ok) throw new Error(`Auth HTTP ${res.status}`);
  const data = await res.json();
  cachedToken  = data.access_token;
  tokenExpiry  = Date.now() + (data.expires_in - 60) * 1000;
  return cachedToken;
}

// Codes INSEE : Lyon 69123, Saint-Étienne 42218
const LOCATIONS = [
  { name: 'Lyon',          commune: '69123' },
  { name: 'Saint-Étienne', commune: '42218' },
];

const KEYWORDS = [
  'alternance systemes reseaux',
  'alternance infrastructure cloud',
  'alternance administrateur systemes',
  'alternance infra securite',
];

async function searchPage(token, keyword, commune) {
  const url = new URL('https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search');
  url.searchParams.set('motsCles',    keyword);
  url.searchParams.set('typeContrat', 'E2');     // Apprentissage
  url.searchParams.set('commune',     commune);
  url.searchParams.set('distance',    '30');
  url.searchParams.set('range',       '0-149');

  const ctrl = new AbortController();
  const tid  = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(url.toString(), {
      signal:  ctrl.signal,
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    if (res.status === 204) return [];
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return (data.resultats || []).map(o => ({
      titre:       o.intitule || '',
      entreprise:  o.entreprise?.nom || '',
      localisation: o.lieuTravail?.libelle || '',
      source:      'france_travail',
      source_id:   o.id || '',
      source_url:  o.origineOffre?.urlOrigine || `https://candidat.francetravail.fr/offres/recherche/detail/${o.id}`,
      description: o.description || '',
      date_publi:  (o.dateCreation || '').split('T')[0],
      salaire:     o.salaire?.libelle || '',
      secteur:     o.secteurActiviteLibelle || '',
      tags:        'alternance,apprentissage',
    }));
  } finally {
    clearTimeout(tid);
  }
}

async function scrape() {
  const token = await getToken();
  const all   = [];
  for (const loc of LOCATIONS) {
    for (const kw of KEYWORDS) {
      try {
        const offres = await searchPage(token, kw, loc.commune);
        all.push(...offres);
        await new Promise(r => setTimeout(r, 600)); // rate-limit
      } catch (e) {
        console.error(`  FT ${loc.name} "${kw}": ${e.message}`);
      }
    }
  }
  console.log(`  France Travail: ${all.length} offres brutes`);
  return all;
}

module.exports = { scrape };
