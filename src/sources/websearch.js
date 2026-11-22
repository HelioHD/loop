// Busca web genérica (DuckDuckGo HTML, com Bing de reserva) — base da descoberta de lojas/marcas.
import * as cheerio from 'cheerio';
import { getText, sleep } from '../http.js';

function ddgUnwrap(href) {
  try {
    const u = new URL(href, 'https://duckduckgo.com');
    const target = u.searchParams.get('uddg');
    return target || null;
  } catch {
    return null;
  }
}

export async function ddg(query) {
  const { text } = await getText('https://html.duckduckgo.com/html/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ q: query, kl: 'br-pt' }).toString(),
  });
  const $ = cheerio.load(text);
  const out = [];
  $('.result').each((_, el) => {
    const a = $(el).find('a.result__a');
    const url = ddgUnwrap(a.attr('href'));
    if (!url || url.includes('duckduckgo.com/y.js') || $(el).hasClass('result--ad')) return;
    out.push({
      title: a.text().trim(),
      url,
      snippet: $(el).find('.result__snippet').text().trim(),
      engine: 'duckduckgo',
    });
  });
  if (!out.length && /anomaly|captcha/i.test(text)) throw new Error('DuckDuckGo pediu captcha');
  return out;
}

function bingUnwrap(href) {
  try {
    const u = new URL(href);
    const enc = u.searchParams.get('u');
    if (u.hostname.endsWith('bing.com') && enc?.startsWith('a1')) {
      const target = new URL(Buffer.from(enc.slice(2), 'base64url').toString('utf8'));
      target.searchParams.delete('msockid');
      return target.toString();
    }
    return href;
  } catch {
    return null;
  }
}

export async function bing(query) {
  const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&cc=br&setlang=pt-br&count=30`;
  const { text } = await getText(url);
  const $ = cheerio.load(text);
  const out = [];
  $('li.b_algo').each((_, el) => {
    const a = $(el).find('h2 a').first();
    const target = bingUnwrap(a.attr('href'));
    if (!target) return;
    out.push({
      title: a.text().trim(),
      url: target,
      snippet: $(el).find('.b_caption p, p').first().text().trim(),
      engine: 'bing',
    });
  });
  return out;
}

function yahooUnwrap(href) {
  const m = href?.match(/\/RU=([^/]+)\//);
  return m ? decodeURIComponent(m[1]) : href;
}

export async function yahoo(query, page = 1) {
  const url = `https://br.search.yahoo.com/search?p=${encodeURIComponent(query)}${page > 1 ? `&b=${(page - 1) * 10 + 1}` : ''}`;
  const { text } = await getText(url);
  const $ = cheerio.load(text);
  const out = [];
  $('#web div.algo').each((_, el) => {
    const a = $(el).find('h3 a').first();
    const target = yahooUnwrap(a.attr('href'));
    if (!target?.startsWith('http')) return;
    out.push({
      title: (a.attr('aria-label') || a.text()).replace(/<[^>]+>/g, '').trim(),
      url: target,
      snippet: $(el).find('.compText').text().trim(),
      engine: 'yahoo',
    });
  });
  return out;
}

// Ordem de preferência: Yahoo BR (melhor relevância raspada), DDG, Bing. Primeiro que devolver algo vence.
const ENGINES = [
  ['yahoo', (q, page) => yahoo(q, page)],
  ['duckduckgo', (q, page) => (page === 1 ? ddg(q) : [])],
  ['bing', (q, page) => (page === 1 ? bing(q) : [])],
];

export async function webSearch(query, { pages = 1 } = {}) {
  for (const [name, run] of ENGINES) {
    try {
      let first = await run(query, 1).catch(() => []);
      // Yahoo às vezes devolve página vazia sob carga: uma segunda tentativa costuma resolver.
      if (!first.length && name === 'yahoo') {
        await sleep(1500);
        first = await run(query, 1);
      }
      if (!first.length) continue;
      const rest = await Promise.all(Array.from({ length: pages - 1 }, (_, i) => run(query, i + 2).catch(() => [])));
      return [...first, ...rest.flat()];
    } catch {
      /* próximo motor */
    }
  }
  return [];
}
