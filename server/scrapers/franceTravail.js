// API France Travail — OAuth2 client_credentials
// Inscription : https://francetravail.io/data/api/offres-emploi
let cachedToken = null;
let tokenExpiry  = 0;

const AUTH_URL = 'https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=/partenaire';
const SCOPES   = ['api_offresdemploiv2 o2dsoffre', 'api_offresdemploiv2', 'o2dsoffre'];

async function getToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
  const id     = process.env.FRANCE_TRAVAIL_CLIENT_ID;
  const secret = process.env.FRANCE_TRAVAIL_CLIENT_SECRET;
  if (!id || !secret) throw new Error('Clés FT absentes');

  for (const scope of SCOPES) {
    const body = new URLSearchParams({ grant_type:'client_credentials', client_id:id, client_secret:secret, scope });
    const res  = await fetch(AUTH_URL, { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body:body.toString() });
    if (res.ok) {
      const data = await res.json();
      if (data.access_token) {
        cachedToken = data.access_token;
        tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
        console.log(`  FT auth OK (scope: ${scope})`);
        return cachedToken;
      }
    }
  }
  throw new Error('Auth FT échouée — vérifier les clés et la souscription à "Offres d\'emploi v2"');
}

const LOCATIONS = [
  { name: 'Lyon',          commune: '69123' },
  { name: 'Saint-Étienne', commune: '42218' },
];

const KEYWORDS = [
  'alternance systemes reseaux',
  'alternance infrastructure',
  'alternance cloud',
  'alternance administrateur systemes',
];

async function searchPage(token, keyword, commune) {
  const url = new URL('https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search');
  url.searchParams.set('motsCles',    keyword);
  url.searchParams.set('typeContrat', 'E2');
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
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`HTTP ${res.status}: ${JSON.stringify(err)}`);
    }
    const data = await res.json();
    return (data.resultats || []).map(o => ({
      titre:        o.intitule || '',
      entreprise:   o.entreprise?.nom || '',
      localisation: o.lieuTravail?.libelle || '',
      source:       'france_travail',
      source_id:    o.id || '',
      source_url:   o.origineOffre?.urlOrigine || `https://candidat.francetravail.fr/offres/recherche/detail/${o.id}`,
      description:  o.description || '',
      date_publi:   (o.dateCreation || '').split('T')[0],
      salaire:      o.salaire?.libelle || '',
      secteur:      o.secteurActiviteLibelle || '',
      tags:         'alternance,apprentissage',
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
        await new Promise(r => setTimeout(r, 500));
      } catch (e) {
        console.error(`  FT ${loc.name} "${kw}": ${e.message}`);
      }
    }
  }
  console.log(`  France Travail: ${all.length} offres brutes`);
  return all;
}

module.exports = { scrape };
