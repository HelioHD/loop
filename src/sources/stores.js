// Descoberta de lojas/marcas: várias consultas na busca web, agrupadas por domínio.
import { webSearch } from './websearch.js';
import { hostOf, sleep } from '../http.js';

// Não são lojas: comparadores/agregadores de promo (já são fontes próprias), redes sociais, conteúdo, governo.
const NOT_STORES = [
  'buscape.com.br', 'zoom.com.br', 'pelando.com.br', 'promobit.com.br', 'google.com', 'bing.com', 'yahoo.com',
  'youtube.com', 'facebook.com', 'tiktok.com', 'pinterest.com', 'br.pinterest.com', 'threads.net',
  'x.com', 'twitter.com', 'reddit.com', 'wikipedia.org', 'pt.wikipedia.org', 'reclameaqui.com.br',
  'linkedin.com', 'medium.com', 'quora.com', 'globo.com', 'uol.com.br', 'terra.com.br', 'tecmundo.com.br',
  'tecnoblog.net', 'olhardigital.com.br', 'canaltech.com.br', 'techtudo.com.br', 'macmagazine.com.br',
  'gov.br', 'abril.com.br', 'r7.com', 'apps.microsoft.com', 'play.google.com', 'apps.apple.com', 'fragrantica.com.br',
  'support.apple.com', 'glassdoor.com.br', 'indeed.com', 'jusbrasil.com.br',
  // notícia/review e sites de cupom/cashback
  'macrumors.com', 'techradar.com', 'macworld.com', 'forbes.com', 'cnet.com', 'theverge.com', '9to5mac.com',
  'tomsguide.com', 'gsmarena.com', 'catracalivre.com.br', 'cupomonline.com.br', 'giraofertas.com.br',
  'cuponomia.com.br', 'meliuz.com.br', 'mundodastribos.com', 'exame.com', 'estadao.com.br', 'folha.uol.com.br',
  'cnnbrasil.com.br', 'infomoney.com.br', 'seudinheiro.com', 'moneytimes.com.br', 'tudocelular.com', 'metropoles.com', 'em.com.br', 'oantagonista.com.br', 'msn.com',
];
const isBlocked = (host) => NOT_STORES.some((d) => host === d || host.endsWith(`.${d}`)) || /\.(gov|edu|jus|mil)(\.br)?$/.test(host);

// Grandes varejistas/marketplaces: entram como loja, com selo, e o link aponta pra página achada (busca/produto).
const BIG_RETAIL = {
  'mercadolivre.com.br': 'Mercado Livre', 'amazon.com.br': 'Amazon', 'shopee.com.br': 'Shopee',
  'magazineluiza.com.br': 'Magalu', 'americanas.com.br': 'Americanas', 'casasbahia.com.br': 'Casas Bahia',
  'pontofrio.com.br': 'Ponto', 'extra.com.br': 'Extra', 'submarino.com.br': 'Submarino', 'carrefour.com.br': 'Carrefour',
  'kabum.com.br': 'KaBuM!', 'fastshop.com.br': 'Fast Shop', 'aliexpress.com': 'AliExpress', 'shein.com': 'Shein',
  'temu.com': 'Temu', 'lojasrenner.com.br': 'Renner', 'riachuelo.com.br': 'Riachuelo', 'cea.com.br': 'C&A',
  'netshoes.com.br': 'Netshoes', 'centauro.com.br': 'Centauro', 'dafiti.com.br': 'Dafiti', 'zattini.com.br': 'Zattini',
  'sephora.com.br': 'Sephora', 'belezanaweb.com.br': 'Beleza na Web', 'epocacosmeticos.com.br': 'Época Cosméticos',
  'leroymerlin.com.br': 'Leroy Merlin', 'havan.com.br': 'Havan', 'girafa.com.br': 'Girafa', 'samsung.com': 'Samsung',
  'apple.com': 'Apple', 'store.vivo.com.br': 'Loja Vivo', 'claro.com.br': 'Claro', 'tim.com.br': 'TIM',
};
const ALIASES = { 'magalu.com.br': 'magazineluiza.com.br', 'vivo.com.br': 'store.vivo.com.br' };
const bigRetailDomain = (host) => Object.keys(BIG_RETAIL).find((d) => host === d || host.endsWith(`.${d}`)) ?? null;

// Agrupa subdomínios na mesma loja: loja.claro.com.br e claro.com.br viram claro.com.br.
function baseDomain(host) {
  const alias = Object.keys(ALIASES).find((d) => host === d || host.endsWith(`.${d}`));
  if (alias) return ALIASES[alias];
  const big = bigRetailDomain(host);
  if (big) return big;
  const parts = host.split('.');
  const n = /\.(com|net|org|art|blog|ind|app)\.br$|\.co\.uk$/.test(host) ? 3 : 2;
  return parts.slice(-n).join('.');
}

// Sinais fracos de "isso é conteúdo, não loja".
const CONTENT_HINT = /\b(blog|not[ií]cias?|artigo|ranking|top \d+|melhores|review|resenha|wiki|revista|dicas|vale a pena|comparativo)\b/i;

function queriesFor(term) {
  return [
    `loja ${term}`, `comprar ${term}`, `${term} loja online`, `${term} preço`,
    `${term} promoção`, `${term} black friday`, `${term} oferta desconto`, `${term} loja oficial`,
  ];
}

const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Fração das palavras do termo (>2 letras) que aparecem no título, snippet ou URL do resultado.
function relevance(term, r) {
  const words = norm(term).split(/\s+/).filter((w) => w.length > 2);
  if (!words.length) return 1;
  let url = r.url;
  try {
    url = decodeURIComponent(r.url);
  } catch {
    /* URL com % inválido: usa crua */
  }
  const hay = norm(`${r.title} ${r.snippet} ${url}`).replace(/[-_/.]/g, ' ');
  return words.filter((w) => hay.includes(w)).length / words.length;
}

// Perfil de Instagram conta como loja própria (chave = @handle); post/reel/explore não.
function instagramHandle(url) {
  const m = url.match(/instagram\.com\/([A-Za-z0-9._]+)\/?(?:[?#]|$)/);
  return m && !['p', 'reel', 'reels', 'explore', 'stories', 'accounts'].includes(m[1]) ? m[1].toLowerCase() : null;
}

// Nome da loja: o pedaço do título que "bate" com o domínio; senão o mais curto; senão o próprio domínio.
function storeName(title, host) {
  const parts = title.replace(/\s*(\.\.\.|…)\s*$/, '').split(/\s[|\-–—:]\s/).map((s) => s.trim()).filter(Boolean);
  const root = norm(host.split('.')[0]).replace(/[^a-z0-9]/g, '');
  const compact = (s) => norm(s).replace(/[^a-z0-9]/g, '');
  const match = parts.find((p) => compact(p).includes(root) || (compact(p).length > 3 && root.includes(compact(p))));
  if (match && match.length <= 40) return match;
  const short = parts.length > 1 ? parts.reduce((a, b) => (a.length <= b.length ? a : b)) : parts[0];
  if (short && short.length <= 40 && !/^(home|in[ií]cio|loja)$/i.test(short)) return short;
  return host.split('.')[0].replace(/-/g, ' ');
}

// Roda as consultas em lotes pequenos: rápido sem martelar o buscador.
async function inBatches(items, size, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
    if (i + size < items.length) await sleep(400);
  }
  return out;
}

export async function findStores(term, log = () => {}) {
  const byHost = new Map();

  const batches = await inBatches(queriesFor(term), 2, async (q) => {
    try {
      const results = await webSearch(q, { pages: 3 });
      log(`web "${q}": ${results.length} resultados (${results[0]?.engine ?? 'nenhum motor respondeu'})`);
      return { q, results };
    } catch (e) {
      log(`web "${q}": falhou (${e.message})`);
      return { q, results: [] };
    }
  });

  for (const { q, results } of batches) {
    for (const r of results) {
      let host = hostOf(r.url);
      if (!host) continue;
      let instagram = null;
      if (host === 'instagram.com') {
        instagram = instagramHandle(r.url);
        if (!instagram) continue;
        host = `instagram.com/${instagram}`;
      }
      if (isBlocked(host)) continue;
      if (!instagram) host = baseDomain(host);
      const big = BIG_RETAIL[bigRetailDomain(host)] ?? null;
      const score = relevance(term, r);
      if (score < 0.5) continue;
      const cur = byHost.get(host);
      if (cur) {
        cur.hits += 1;
        if (score > cur.score) Object.assign(cur, { score, landing: r.url, title: r.title, snippet: r.snippet || cur.snippet });
        if (!cur.queries.includes(q)) cur.queries.push(q);
        continue;
      }
      byHost.set(host, {
        host,
        name: instagram ? `@${instagram}` : big ?? storeName(r.title, host),
        url: instagram ? `https://www.instagram.com/${instagram}/` : `https://${new URL(r.url).hostname}/`,
        // ^ mantém o host original (ex.: loja.wap.ind.br) como entrada; a chave de agrupamento é o domínio base.
        channel: instagram ? 'instagram' : 'site',
        bigRetail: !!big,
        landing: r.url,
        title: r.title,
        snippet: r.snippet,
        engine: r.engine,
        hits: 1,
        score,
        queries: [q],
        likelyContent: !big && CONTENT_HINT.test(`${r.title} ${r.url}`),
      });
    }
  }

  const stores = [...byHost.values()].sort(
    (a, b) => Number(a.likelyContent) - Number(b.likelyContent) || b.hits * b.score - a.hits * a.score
  );
  return { stores };
}
