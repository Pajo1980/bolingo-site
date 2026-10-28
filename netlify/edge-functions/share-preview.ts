// Aperçu des liens partagés : /post/<id>, /live-recap/<id>, /user/<id>, /sound/<id>.
// Lit titre, description et image par la fonction SQL get_share_preview (Supabase), qui ne
// renvoie RIEN pour un contenu non public. Toute erreur ou absence de ligne = aperçu générique.
// Variables Netlify : SUPABASE_URL et SUPABASE_ANON_KEY (jamais écrites ici).

const KINDS = ['post', 'live-recap', 'user', 'sound'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const GENERIC_TITLE = 'Ce contenu est sur Bolingo';
const GENERIC_DESC =
  "Installe l'application Bolingo pour découvrir ce contenu : le réseau social de la diaspora africaine.";
const GENERIC_IMAGE = 'https://www.bolingodiaspora.com/bolingo-partage.jpg';

type Preview = { title: string; description: string | null; image: string | null };

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function fetchPreview(kind: string, id: string): Promise<Preview | null> {
  const env = (globalThis as any).Netlify?.env;
  const base = env?.get('SUPABASE_URL');
  const key = env?.get('SUPABASE_ANON_KEY');
  if (!base || !key) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 3000);
  try {
    const res = await fetch(`${base.replace(/\/+$/, '')}/rest/v1/rpc/get_share_preview`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_kind: kind, p_id: id }),
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const rows = await res.json();
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row || typeof row.title !== 'string' || !row.title.trim()) return null;
    const image =
      typeof row.image_url === 'string' && /^https:\/\//i.test(row.image_url) ? row.image_url : null;
    return {
      title: row.title,
      description: typeof row.description === 'string' && row.description.trim() ? row.description : null,
      image,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function page(opts: {
  title: string;
  description: string;
  image: string;
  imageW: number;
  imageH: number;
  url: string;
  openHref: string | null;
}): string {
  const t = esc(opts.title);
  const d = esc(opts.description);
  const img = esc(opts.image);
  const url = esc(opts.url);
  const open = opts.openHref
    ? `<a class="btn open" id="open-app" href="${esc(opts.openHref)}">Ouvrir dans l'application</a>`
    : '';
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${t}</title>
<meta name="description" content="${d}">
<meta property="og:site_name" content="Bolingo">
<meta property="og:type" content="website">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${d}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${img}">
<meta property="og:image:width" content="${opts.imageW}">
<meta property="og:image:height" content="${opts.imageH}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${t}">
<meta name="twitter:description" content="${d}">
<meta name="twitter:image" content="${img}">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background:#1A0808; color:#FFFFFF;
    min-height:100vh; display:flex; align-items:center; justify-content:center;
    padding:24px; text-align:center;
  }
  .card { max-width:420px; width:100%; }
  .logo { width:96px; height:96px; border-radius:24px; margin-bottom:28px; }
  h1 { font-size:26px; font-weight:700; margin-bottom:14px; line-height:1.3; overflow-wrap:anywhere; }
  p { font-size:15px; line-height:1.6; color:rgba(255,255,255,0.65); margin-bottom:32px; overflow-wrap:anywhere; }
  .btns { display:flex; flex-direction:column; gap:12px; margin-bottom:28px; }
  a.btn {
    display:block; padding:15px 24px; border-radius:28px;
    text-decoration:none; font-size:15px; font-weight:600;
    background:#E8305A; color:#FFFFFF;
  }
  a.btn.alt { background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.18); }
  a.btn.open { background:#D4A853; color:#1A0808; }
  .home { font-size:13px; color:rgba(255,255,255,0.4); text-decoration:none; }
  .home:hover { color:#D4A853; }
</style>
</head>
<body>
  <div class="card">
    <img src="/bolingo-logo.png" alt="Bolingo" class="logo">
    <h1>${t}</h1>
    <p>${d}</p>
    <div class="btns">
      ${open}
      <a class="btn" href="https://apps.apple.com/app/id6764163338">Télécharger sur l'App Store</a>
      <a class="btn alt" href="https://play.google.com/store/apps/details?id=com.bolingo.app">Télécharger sur Google Play</a>
    </div>
    <a class="home" href="/">Retour à l'accueil</a>
  </div>
</body>
</html>`;
}

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const [kind, id] = url.pathname.split('/').filter(Boolean);
  const valid = KINDS.includes(kind) && typeof id === 'string' && UUID.test(id);

  const preview = valid ? await fetchPreview(kind, id.toLowerCase()) : null;

  const html = page({
    title: preview ? preview.title : GENERIC_TITLE,
    description: preview ? (preview.description ?? GENERIC_DESC) : GENERIC_DESC,
    image: preview && preview.image ? preview.image : GENERIC_IMAGE,
    imageW: preview && preview.image ? 600 : 1200,
    imageH: preview && preview.image ? 315 : 630,
    url: url.origin + url.pathname,
    // Le bouton « Ouvrir » n'existe que pour un chemin que l'app sait ouvrir.
    openHref: valid ? `bolingo://${kind}/${id.toLowerCase()}` : null,
  });

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
