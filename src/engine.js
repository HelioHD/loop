// Orquestra uma varredura: roda as fontes por modo, junta, ordena e devolve resultado + log.
import { findStores } from './sources/stores.js';
import { buscape, zoom } from './sources/buscape.js';
import { kabum } from './sources/kabum.js';
import { pelando } from './sources/pelando.js';
import { mercadoLivre, mlSearchUrl } from './sources/mercadolivre.js';

export const MODES = ['stores', 'products', 'promos'];

async function step(log, label, fn) {
  const t0 = Date.now();
  try {
    const r = await fn();
    log.push({ source: label, ok: true, count: Array.isArray(r) ? r.length : undefined, ms: Date.now() - t0 });
    return r;
  } catch (e) {
    log.push({ source: label, ok: false, error: e.message, ms: Date.now() - t0 });
    return null;
  }
}

const byDiscountThenPrice = (a, b) => (b.discount ?? -1) - (a.discount ?? -1) || (a.price ?? Infinity) - (b.price ?? Infinity);
const productKey = (p) => `${p.title.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()}|${p.price ?? ''}`;

export async function runSearch(term, modes = MODES) {
  const log = [];
  const result = { term, stores: [], products: [], promos: [], links: { mercadoLivre: mlSearchUrl(term) } };

  const jobs = [];
  if (modes.includes('stores')) {
    jobs.push(
      step(log, 'lojas (busca web)', async () => {
        const notes = [];
        const r = await findStores(term, (m) => notes.push(m));
        log.push({ source: 'lojas: detalhe', ok: true, notes });
        result.stores = r.stores;
        return r.stores;
      })
    );
  }
  if (modes.includes('products')) {
    const add = (label, fn) => jobs.push(step(log, label, async () => {
      const r = await fn(term);
      result.products.push(...r);
      return r;
    }));
    add('buscapé', buscape);
    add('zoom', zoom);
    add('kabum', kabum);
    add('mercado livre (via busca web)', mercadoLivre);
  }
  if (modes.includes('promos')) {
    jobs.push(step(log, 'pelando', async () => (result.promos = await pelando(term))));
  }
  await Promise.all(jobs);

  // Dedup por URL e por título+preço (Buscapé e Zoom repetem catálogo); ordena por desconto, depois menor preço.
  const seen = new Set();
  result.products = result.products
    .filter((p) => {
      const keys = [p.url, productKey(p)];
      if (keys.some((k) => seen.has(k))) return false;
      keys.forEach((k) => seen.add(k));
      return true;
    })
    .sort(byDiscountThenPrice);
  result.promos.sort((a, b) => new Date(b.extra.postedAt ?? 0) - new Date(a.extra.postedAt ?? 0));

  const anyOk = log.some((l) => l.ok && l.count !== undefined);
  return { status: anyOk ? 'done' : 'failed', result, log };
}
