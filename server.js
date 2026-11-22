// Loop — Looking Promos · servidor local
// Autor / Author: Hélio Delfino Lopes de Alcântara — Pesquisador e pentester web especializado / Security researcher & web penetration tester
import express from 'express';
import { searches } from './src/db.js';
import { runSearch, MODES } from './src/engine.js';

const app = express();
const PORT = Number(process.env.PORT) || 4747;

app.use(express.json());
app.use(express.static(new URL('./public/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')));

async function execute(id, term, modes) {
  try {
    const { status, result, log } = await runSearch(term, modes);
    searches.finish(id, status, result, log);
  } catch (e) {
    searches.finish(id, 'failed', null, [{ source: 'engine', ok: false, error: e.message }]);
  }
}

app.post('/api/searches', (req, res) => {
  const term = String(req.body?.term ?? '').trim();
  if (!term || term.length > 120) return res.status(400).json({ error: 'termo inválido' });
  const modes = (Array.isArray(req.body?.modes) ? req.body.modes : MODES).filter((m) => MODES.includes(m));
  if (!modes.length) return res.status(400).json({ error: 'escolha ao menos um modo' });
  const id = searches.create(term, modes);
  execute(id, term, modes); // roda em background; o front faz polling
  res.status(202).json({ id });
});

app.get('/api/searches', (_req, res) => res.json(searches.list()));

app.get('/api/searches/:id', (req, res) => {
  const s = searches.get(Number(req.params.id));
  return s ? res.json(s) : res.status(404).json({ error: 'não encontrada' });
});

app.post('/api/searches/:id/rerun', (req, res) => {
  const s = searches.get(Number(req.params.id));
  if (!s) return res.status(404).json({ error: 'não encontrada' });
  const id = searches.create(s.term, s.modes);
  if (s.saved) searches.setSaved(id, true);
  execute(id, s.term, s.modes);
  res.status(202).json({ id });
});

app.patch('/api/searches/:id', (req, res) => {
  searches.setSaved(Number(req.params.id), !!req.body?.saved);
  res.json({ ok: true });
});

app.delete('/api/searches/:id', (req, res) => {
  searches.remove(Number(req.params.id));
  res.json({ ok: true });
});

// Proxy de imagem: alguns CDNs (Pelando) recusam hotlink. Só hosts conhecidos — nada de proxy aberto.
const IMG_DOMAINS = ['pelando.com.br', 'zst.com.br', 'mlstatic.com', 'kabum.com.br'];
const imgAllowed = (host) => IMG_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
app.get('/api/img', async (req, res) => {
  let target;
  try {
    target = new URL(String(req.query.u));
  } catch {
    return res.status(400).end();
  }
  if (target.protocol !== 'https:' || !imgAllowed(target.hostname)) return res.status(403).end();
  try {
    const r = await fetch(target, {
      signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36' },
    });
    const type = r.headers.get('content-type') ?? '';
    if (!r.ok || !type.startsWith('image/')) return res.status(502).end();
    res.setHeader('Content-Type', type);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(Buffer.from(await r.arrayBuffer()));
  } catch {
    res.status(502).end();
  }
});

const csvCell = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

app.get('/api/searches/:id/export.csv', (req, res) => {
  const s = searches.get(Number(req.params.id));
  if (!s?.result) return res.status(404).send('sem resultado');
  const rows = [['tipo', 'fonte', 'nome', 'loja', 'preco', 'desconto_pct', 'url']];
  for (const st of s.result.stores) rows.push(['loja', st.engine, st.name, st.host, '', '', st.url]);
  for (const p of s.result.products) rows.push(['produto', p.source, p.title, p.store, p.price, p.discount, p.url]);
  for (const p of s.result.promos) rows.push(['promocao', p.source, p.title, p.store, p.price, p.discount, p.url]);
  const slug = s.term.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="loop-${slug}-${s.id}.csv"`);
  res.send('﻿' + rows.map((r) => r.map(csvCell).join(';')).join('\n'));
});

app.listen(PORT, '127.0.0.1', () => console.log(`LOOP rodando em http://127.0.0.1:${PORT}`));
