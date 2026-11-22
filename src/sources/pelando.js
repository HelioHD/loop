// Pelando: promoções postadas pela comunidade. Os dados vêm serializados nas "astro-island" da página.
import * as cheerio from 'cheerio';
import { getText } from '../http.js';

// Formato de props do Astro: [0, valor] = valor/objeto, [1, [...]] = array.
function decode(v) {
  if (!Array.isArray(v)) return v;
  const [t, x] = v;
  if (t === 0) return x && typeof x === 'object' ? Object.fromEntries(Object.entries(x).map(([k, y]) => [k, decode(y)])) : x;
  if (t === 1) return x.map(decode);
  return x;
}

export async function pelando(term) {
  const slug = term.trim().toLowerCase().replace(/\s+/g, '-');
  const { text } = await getText(`https://www.pelando.com.br/busca/${encodeURIComponent(slug)}`);
  const $ = cheerio.load(text);
  let deals = [];
  $('astro-island[component-url*="SearchFeed"]').each((_, el) => {
    const raw = $(el).attr('props');
    if (!raw) return;
    const props = Object.fromEntries(Object.entries(JSON.parse(raw)).map(([k, v]) => [k, decode(v)]));
    deals = props.initialData?.deals?.deals ?? deals;
  });
  return deals
    .filter((d) => d.status === 'active')
    .map((d) => ({
      source: 'pelando',
      id: `pelando:${d.id}`,
      title: d.title,
      price: typeof d.price === 'number' ? d.price : null,
      oldPrice: null,
      discount: d.discountPercentage ?? null,
      store: d.store?.name ?? null,
      image: d.imageSrcset?.at(-1)?.url ?? d.imageUrl ?? null,
      url: d.sourceUrl || `https://www.pelando.com.br/d/${d.slug}`,
      extra: {
        pelandoUrl: `https://www.pelando.com.br/d/${d.slug}`,
        temperature: d.temperature,
        comments: d.commentCount,
        postedAt: d.createdAt,
        freeShipping: d.freeShipping,
        coupon: d.kind === 'coupon',
      },
    }));
}
