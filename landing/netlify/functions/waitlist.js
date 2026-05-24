const RENDER_URL = process.env.RENDER_URL || 'https://alternance-tracker.onrender.com';

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    let body = {};
    const ct = event.headers['content-type'] || '';
    if (ct.includes('application/x-www-form-urlencoded')) {
      const params = new URLSearchParams(event.body || '');
      params.forEach((v, k) => { body[k] = v; });
    } else {
      body = JSON.parse(event.body || '{}');
    }

    const { name = '', email = '', profile = '' } = body;
    if (!email || !email.includes('@')) {
      return {
        statusCode: 303,
        headers: { ...headers, Location: '/merci.html?err=email' },
        body: '',
      };
    }

    // Fire-and-forget — ne bloque pas la redirection même si Render est en cold start
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      await fetch(`${RENDER_URL}/api/waitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, profile }),
        signal: controller.signal,
      });
    } catch (_) {
      // Render cold start ou hors-ligne — on laisse passer
    } finally {
      clearTimeout(timeout);
    }

    return {
      statusCode: 303,
      headers: { ...headers, Location: '/merci.html' },
      body: '',
    };
  } catch (e) {
    console.error('waitlist error:', e);
    return {
      statusCode: 303,
      headers: { ...headers, Location: '/merci.html?err=1' },
      body: '',
    };
  }
};
