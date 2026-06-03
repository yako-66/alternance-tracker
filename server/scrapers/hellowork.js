const cheerio = require('cheerio');

const SEARCHES = [
  { keywords: 'alternance systemes reseaux', location: 'Lyon (69)' },
  { keywords: 'alternance infra cloud',      location: 'Lyon (69)' },
  { keywords: 'alternance systemes reseaux', location: 'Saint-Etienne (42)' },
  { keywords: 'alternance infra cloud',      location: 'Saint-Etienne (42)' },
];

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept:       'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'fr-FR,fr;q=0.9',
};

function parseJsonLd($) {
  const offres = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const raw = JSON.parse($(el).html() || '{}');
      const items = Array.isArray(raw) ? raw
        : raw['@type'] === 'ItemList' ? (raw.itemListElement || []).map(e => e.item || e)
        : raw['@type'] === 'JobPosting' ? [raw]
        : [];
      for (const j of items) {
        if (j?.['@type'] !== 'JobPosting') continue;
        offres.push({
          titre:       j.title || '',
          entreprise:  j.hiringOrganization?.name || '',
          localisation: j.jobLocation?.address?.addressLocality || '',
          source:      'hellowork',
          source_id:   `hw_${j.identifier?.value || Buffer.from(j.url || j.title || String(Math.random())).toString('base64').slice(0, 16)}`,
          source_url:  j.url || '',
          description: (j.description || '').slice(0, 2000),
          date_publi:  (j.datePosted || '').split('T')[0],
          salaire:     j.baseSalary?.value?.value ? `${j.baseSalary.value.value}€` : '',
          secteur:     j.occupationalCategory || '',
          tags:        'alternance',
        });
      }
    } catch {}
  });
  return offres;
}

function parseCards($) {
  const offres = [];
  // HelloWork SSR — sélecteurs stables en juin 2025
  $('article, li[class*="job"], div[data-id]').each((_, el) => {
    const $e = $(el);
    const titre       = $e.find('[class*="title"], h2, h3').first().text().trim();
    const entreprise  = $e.find('[class*="company"], [class*="employer"]').first().text().trim();
    const localisation = $e.find('[class*="location"], [class*="city"]').first().text().trim();
    const salaire     = $e.find('[class*="salary"]').first().text().trim();
    const href        = $e.find('a[href*="/emploi/"]').first().attr('href') || '';
    const source_url  = href.startsWith('http') ? href : href ? `https://www.hellowork.com${href}` : '';
    const slug        = href.split('/').filter(Boolean).pop()?.split('?')[0] || '';
    if (!titre || !slug) return;
    offres.push({
      titre, entreprise, localisation, salaire,
      source: 'hellowork', source_id: `hw_${slug}`, source_url,
      description: '', date_publi: '', secteur: '', tags: 'alternance',
    });
  });
  return offres;
}

async function scrapeSearch({ keywords, location }) {
  const url = `https://www.hellowork.com/fr-fr/emploi/recherche.html?k=${encodeURIComponent(keywords)}&l=${encodeURIComponent(location)}&c=ALTERNANCE`;
  const ctrl = new AbortController();
  const tid  = setTimeout(() => ctrl.abort(), 25000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: HEADERS });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    const $    = cheerio.load(html);

    // Priorité : données structurées JSON-LD > parsing HTML
    const fromJsonLd = parseJsonLd($);
    if (fromJsonLd.length) return fromJsonLd;
    return parseCards($);
  } finally {
    clearTimeout(tid);
  }
}

async function scrape() {
  const all = [];
  for (const s of SEARCHES) {
    try {
      const offres = await scrapeSearch(s);
      all.push(...offres);
      console.log(`  HelloWork "${s.keywords}" ${s.location}: ${offres.length} offres`);
      await new Promise(r => setTimeout(r, 1500));
    } catch (e) {
      console.error(`  HelloWork "${s.keywords}" ${s.location}: ${e.message}`);
    }
  }
  return all;
}

module.exports = { scrape };
