// KaBuM: catálogo inteiro vem no __NEXT_DATA__ (pageProps.data é uma string JSON).
import { getText, nextData } from '../http.js';

const best = (...vals) => Math.min(...vals.filter((v) => typeof v === 'number' && v > 0));

export async function kabum(term) {
  const { text } = await getText(`https://www.kabum.com.br/busca/${encodeURIComponent(term)}?page_size=100`);
  const raw = nextData(text)?.props?.pageProps?.data;
  const items = (typeof raw === 'string' ? JSON.parse(raw) : raw)?.catalogServer?.data ?? [];
  return items
    .filter((p) => p.available)
    .map((p) => {
      // Menor entre preço à vista e oferta relâmpago; "de" = preço cheio.
      const price = best(p.priceWithDiscount, p.offer?.priceWithDiscount, p.price);
      const oldPrice = p.oldPrice > price ? p.oldPrice : null;
      return {
        source: 'kabum',
        id: `kabum:${p.code}`,
        title: p.name,
        price: Number.isFinite(price) ? price : null,
        oldPrice,
        discount: oldPrice ? Math.round((1 - price / oldPrice) * 100) : null,
        store: p.sellerName || 'KaBuM!',
        image: p.image ?? null,
        url: `https://www.kabum.com.br/produto/${p.code}/${p.friendlyName}`,
        extra: { offer: !!p.offer, rating: p.rating || null },
      };
    });
}
