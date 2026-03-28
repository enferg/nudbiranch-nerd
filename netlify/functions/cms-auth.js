const crypto = require('crypto');

function sign(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

function makeToken(secret) {
  const ts = Date.now().toString();
  const sig = sign(ts, secret);
  const raw = JSON.stringify({ ts, sig });
  return Buffer.from(raw).toString('base64url');
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const { CMS_PASSWORD, CMS_SECRET } = process.env;

  if (!CMS_PASSWORD || !CMS_SECRET) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'CMS not configured' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  if (body.password !== CMS_PASSWORD) {
    // Constant-time comparison to prevent timing attacks
    crypto.timingSafeEqual(
      Buffer.from(body.password || ''),
      Buffer.from(CMS_PASSWORD)
    );
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid password' }) };
  }

  const token = makeToken(CMS_SECRET);
  return { statusCode: 200, headers, body: JSON.stringify({ token }) };
};
