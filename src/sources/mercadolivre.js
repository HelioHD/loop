// Mercado Livre: a API pública responde 403 e a listagem cai em "account-verification" (fetch e headless).
// Então: anúncios achados via busca web restrita ao domínio (sem preço) + link direto da busca no ML.
import { webSearch } from './websearch.js';
import { hostOf } from '../http.js';

export function mlSearchUrl(term) {
  return `https://lista.mercadolivre.com.br/${encodeURIComponent(term.trim().toLowerCase().replace(/\s+/g, '-'))}`;
}

export async function mercadoLivre(term) {
  const results = await webSearch(`site:mercadolivre.com.br ${term}`);
  return results
    .filter((r) => hostOf(r.url)?.endsWith('mercadolivre.com.br'))
    .map((r) => {
      const isListing = /\/MLB-?\d+|\/p\/MLB|\/up\/MLBU/i.test(r.url);
      const isStore = /\/loja\/|\/pagina\//i.test(r.url);
      return {
        source: 'mercadolivre',
        id: `ml:${r.url}`,
        title: r.title.replace(/\s*\|\s*Mercado\s*Livre.*$/i, '').trim(),
        price: null,
        oldPrice: null,
        discount: null,
        store: isStore ? 'Loja oficial no ML' : 'Mercado Livre',
        image: null,
        url: r.url,
        extra: { kind: isStore ? 'store' : isListing ? 'listing' : 'search', snippet: r.snippet },
      };
    });
}
