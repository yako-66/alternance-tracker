// Adzuna Job API — gratuit, 1000 appels/jour
// Inscription : https://developer.adzuna.com/

const APP_ID  = process.env.ADZUNA_APP_ID;
const APP_KEY = process.env.ADZUNA_APP_KEY;

const SEARCHES = [
  { what: 'alternance systèmes réseaux',  where: 'Lyon' },
  { what: 'alternance infrastructure',     where: 'Lyon' },
  { what: 'alternance cloud sécurité',    where: 'Lyon' },
  { what: 'alternance systèmes réseaux',  where: 'Saint-Étienne' },
  { what: 'alternance infra cloud',       where: 'Saint-Étienne' },
];

async function searchPage({ what, where }) {
  const url = new URL('https://api.adzuna.com/v1/api/jobs/fr/search/1');
  url.searchParams.set('app_id',  APP_ID);
  url.searchParams.set('app_key', APP_KEY);
  url.searchParams.set('what',    what);
  url.searchParams.set('where',   where);
  url.searchParams.set('distance', '30');
  url.searchParams.set('results_per_page', '50');
  url.searchParams.set('content-type', 'application/json');

  const ctrl = new AbortController();
  const tid  = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(url.toString(), {
      signal:  ctrl.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return (data.results || []).map(o => ({
      titre:       o.title || '',
      entreprise:  o.company?.display_name || '',
      localisation: o.location?.display_name || where,
      source:      'adzuna',
      source_id:   String(o.id || ''),
      source_url:  o.redirect_url || '',
      description: (o.description || '').slice(0, 3000),
      date_publi:  (o.created || '').split('T')[0],
      salaire:     o.salary_min ? `${Math.round(o.salary_min / 12)}€/mois` : '',
      secteur:     o.category?.label || '',
      tags:        'alternance',
    }));
  } finally {
    clearTimeout(tid);
  }
}

async function scrape() {
  if (!APP_ID || !APP_KEY) {
    console.log('  Adzuna ignoré (ADZUNA_APP_ID/APP_KEY absents)');
    return [];
  }
  const all = [];
  for (const s of SEARCHES) {
    try {
      const offres = await searchPage(s);
      all.push(...offres);
      console.log(`  Adzuna "${s.what}" ${s.where}: ${offres.length} offres`);
      await new Promise(r => setTimeout(r, 800));
    } catch (e) {
      console.error(`  Adzuna "${s.what}" ${s.where}: ${e.message}`);
    }
  }
  return all;
}

module.exports = { scrape };
