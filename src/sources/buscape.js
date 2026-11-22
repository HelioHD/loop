// Buscapé e Zoom (mesmo grupo, mesmo formato): comparadores de preço, devolvem produto + menor preço + loja da melhor oferta.
import { getText, nextData } from '../http.js';

async function comparator(source, base, term, pages) {
  const out = [];
  const fetchPage = async (page) => {
    const url = `${base}/search?q=${encodeURIComponent(term)}${page > 1 ? `&page=${page}` : ''}`;
    const { text } = await getText(url);
    return nextData(text)?.props?.initialReduxState?.hits?.hits ?? [];
  };
  // Páginas em paralelo; página que falhar só fica de fora.
  const results = await Promise.allSettled(Array.from({ length: pages }, (_, i) => fetchPage(i + 1)));
  if (results[0].status === 'rejected') throw results[0].reason;
  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    for (const h of r.value) {
      if (!h.price) continue;
      // Repete o mesmo anúncio entre páginas/variações: mesmo nome + preço = duplicata.
      if (out.some((p) => p.title === h.name && p.price === h.price)) continue;
      out.push({
        source,
        id: `${source}:${h.objectId}`,
        title: h.name,
        price: h.price,
        oldPrice: null,
        discount: h.loweringPercentage ? Math.round(h.loweringPercentage) : null,
        store: h.bestOffer?.merchantName ?? h.merchants?.[0]?.name ?? null,
        storeCount: h.storeCount ?? null,
        image: h.image ?? null,
        url: h.url?.startsWith('http') ? h.url : `${base}${h.url}`,
        extra: { category: h.categoryName, cashback: h.cashback?.cashbackValue ?? null },
      });
    }
  }
  return out;
}

export const buscape = (term, pages = 5) => comparator('buscape', 'https://www.buscape.com.br', term, pages);
export const zoom = (term, pages = 3) => comparator('zoom', 'https://www.zoom.com.br', term, pages);
