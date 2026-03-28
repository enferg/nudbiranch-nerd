const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  const page = event.queryStringParameters?.page || '/';
  // Normalize to a safe blob key: "/" → "index", "/about.html" → "about.html"
  const key = page.replace(/^\//, '') || 'index';

  try {
    const store = getStore('cms-content');
    const raw = await store.get(key);
    if (!raw) {
      return { statusCode: 200, headers, body: JSON.stringify({}) };
    }
    return { statusCode: 200, headers, body: raw };
  } catch (err) {
    console.error('cms-load error:', err);
    return { statusCode: 200, headers, body: JSON.stringify({}) };
  }
};
