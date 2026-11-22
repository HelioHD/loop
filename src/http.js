// Loop — Looking Promos
// Autor / Author: Hélio Delfino Lopes de Alcântara — Pesquisador e pentester web especializado / Security researcher & web penetration tester

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function getText(url, { timeout = 15000, headers = {}, method = 'GET', body } = {}) {
  const res = await fetch(url, {
    method,
    body,
    redirect: 'follow',
    signal: AbortSignal.timeout(timeout),
    headers: {
      'User-Agent': UA,
      'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.7',
      Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
      ...headers,
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} em ${new URL(url).host}`);
  return { text: await res.text(), finalUrl: res.url };
}

export function nextData(html) {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  return m ? JSON.parse(m[1]) : null;
}

export function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}
