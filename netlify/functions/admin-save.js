/**
 * Netlify Function: admin-save
 * Variabili d'ambiente su Netlify:
 *   SUPABASE_URL          = https://xxxxxxxx.supabase.co
 *   SUPABASE_SERVICE_KEY  = service_role key
 *   ADMIN_PASSWORD        = password admin del sito
 */

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;
const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'admin123';

const sbHeaders = {
  'Content-Type': 'application/json',
  'apikey': SB_KEY,
  'Authorization': 'Bearer ' + SB_KEY,
  'Prefer': 'resolution=merge-duplicates,return=minimal'
};

async function sbUpsert(table, data) {
  const r = await fetch(`${SB_URL}/rest/v1/${table}`, {
    method: 'POST', headers: sbHeaders, body: JSON.stringify(data)
  });
  if (!r.ok) throw new Error(`${table} upsert (${r.status}): ${await r.text()}`);
}

async function sbDelete(table, filter) {
  const r = await fetch(`${SB_URL}/rest/v1/${table}?${filter}`, {
    method: 'DELETE', headers: sbHeaders
  });
  if (!r.ok) throw new Error(`${table} delete (${r.status}): ${await r.text()}`);
}

exports.handler = async (event) => {
  const cors = { 'Access-Control-Allow-Origin': '*' };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { ...cors, 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type' }, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: cors, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { password, settings, menu, igReels } = body;

  if (!password || password !== ADMIN_PASS) {
    return { statusCode: 401, headers: cors, body: JSON.stringify({ error: 'Unauthorized' }) };
  }
  if (!SB_URL || !SB_KEY) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: 'Env vars missing on server' }) };
  }

  try {
    if (settings) {
      const rows = Object.entries(settings)
        .filter(([k]) => k !== 'igReels')
        .map(([k, v]) => ({ key: k, value: JSON.stringify(v) }));
      await sbUpsert('pz_settings', rows);
    }

    if (menu && Array.isArray(menu)) {
      await sbDelete('pz_menu', 'id=gte.0');
      if (menu.length > 0) {
        const rows = menu.map((item, i) => ({
          id: item.id,
          name: item.name || '',
          cat: item.cat || '',
          price: parseFloat(item.price) || 0,
          description: item.description || item.desc || '',
          img: item.img || '',
          badge: item.badge || '',
          sort_order: i
        }));
        await sbUpsert('pz_menu', rows);
      }
    }

    if (Array.isArray(igReels)) {
      await sbDelete('pz_ig_reels', 'id=gte.0');
      if (igReels.length > 0) {
        const rows = igReels.map((r, i) => ({
          url: r.url || '', caption: r.caption || '', thumb: r.thumb || '', sort_order: i
        }));
        await sbUpsert('pz_ig_reels', rows);
      }
    }

    return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true }) };

  } catch (e) {
    console.error('admin-save:', e.message);
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: e.message }) };
  }
};
