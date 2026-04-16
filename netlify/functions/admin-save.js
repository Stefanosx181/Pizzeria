/**
 * Netlify Function: admin-save
 * Riceve i dati dall'admin, verifica la password, scrive su Supabase
 * con la service_role key che vive solo qui, mai nel browser.
 *
 * Variabili d'ambiente da impostare su Netlify:
 *   SUPABASE_URL          = https://xxxxxxxx.supabase.co
 *   SUPABASE_SERVICE_KEY  = la service_role key (da Supabase > Settings > API Keys > Secret keys)
 *   ADMIN_PASSWORD        = password admin (deve corrispondere a quella nel sito)
 */

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;
const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'admin123';

const headers = {
  'Content-Type': 'application/json',
  'apikey': SB_KEY,
  'Authorization': 'Bearer ' + SB_KEY,
  'Prefer': 'resolution=merge-duplicates,return=representation'
};

async function sbUpsert(table, data) {
  const r = await fetch(`${SB_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data)
  });
  if (!r.ok) throw new Error(`${table}: ${await r.text()}`);
  return r.json();
}

async function sbDelete(table, filter) {
  const r = await fetch(`${SB_URL}/rest/v1/${table}?${filter}`, {
    method: 'DELETE',
    headers
  });
  if (!r.ok) throw new Error(`delete ${table}: ${await r.text()}`);
}

exports.handler = async (event) => {
  // Solo POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { password, settings, menu, igReels } = body;

  // Verifica password admin
  if (!password || password !== ADMIN_PASS) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  if (!SB_URL || !SB_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Supabase not configured on server' }) };
  }

  try {
    // 1. Salva impostazioni
    if (settings) {
      const sRows = Object.entries(settings).map(([k, v]) => ({
        key: k,
        value: JSON.stringify(v)
      }));
      await sbUpsert('pz_settings', sRows);
    }

    // 2. Salva menù
    if (menu) {
      await sbDelete('pz_menu', 'id=gte.0');
      if (menu.length > 0) {
        const mRows = menu.map((item, i) => ({ ...item, sort_order: i }));
        await sbUpsert('pz_menu', mRows);
      }
    }

    // 3. Salva Instagram Reels
    if (igReels !== undefined) {
      await sbDelete('pz_ig_reels', 'id=gte.0');
      if (igReels.length > 0) {
        const iRows = igReels.map((r, i) => ({
          url: r.url || '',
          caption: r.caption || '',
          thumb: r.thumb || '',
          sort_order: i
        }));
        await sbUpsert('pz_ig_reels', iRows);
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, saved: { settings: !!settings, menu: menu?.length, reels: igReels?.length } })
    };

  } catch (e) {
    console.error('admin-save error:', e.message);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
