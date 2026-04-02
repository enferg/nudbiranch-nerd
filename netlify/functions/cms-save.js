const crypto = require('crypto');
const { getStore } = require('@netlify/blobs');

const TOKEN_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

function sign(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

function verifyToken(token, secret) {
  try {
    const raw = Buffer.from(token, 'base64url').toString('utf8');
    const { ts, sig } = JSON.parse(raw);
    const expected = sign(ts, secret);
    const valid = crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
    const fresh = Date.now() - parseInt(ts, 10) < TOKEN_TTL_MS;
    return valid && fresh;
  } catch {
    return false;
  }
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const { CMS_SECRET } = process.env;
  if (!CMS_SECRET) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'CMS not configured' }) };
  }

  const authHeader = event.headers['authorization'] || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!verifyToken(token, CMS_SECRET)) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { page, content } = body;
  if (!page || typeof content !== 'object') {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing page or content' }) };
  }

  const key = page.replace(/^\//, '') || 'index';

  try {
    const store = getStore({
      name: 'cms-content',
      siteID: process.env.NETLIFY_SITE_ID || process.env.SITE_ID,
      token: process.env.NETLIFY_TOKEN,
    });
    // Merge with existing content so a partial save doesn't wipe other fields
    const existing = await store.get(key);
    const current = existing ? JSON.parse(existing) : {};
    const merged = { ...current, ...content };
    await store.set(key, JSON.stringify(merged));
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error('cms-save error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Save failed' }) };
  }
};
