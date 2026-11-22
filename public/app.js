// Loop — Looking Promos · front-end
// Autor / Author: Hélio Delfino Lopes de Alcântara — Pesquisador e pentester web especializado / Security researcher & web penetration tester

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// Tudo que vem da web passa por aqui antes de virar HTML.
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const safeUrl = (u) => (/^https?:\/\//i.test(u ?? '') ? u : '#');
const brl = (n) => (typeof n === 'number' ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : null);
const img = (u) => (/^https?:\/\//i.test(u ?? '') ? `/api/img?u=${encodeURIComponent(u)}` : '');
const when = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '');

const api = {
  async req(method, url, body) {
    const r = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
    return data;
  },
  list: () => api.req('GET', '/api/searches'),
  get: (id) => api.req('GET', `/api/searches/${id}`),
  create: (term, modes) => api.req('POST', '/api/searches', { term, modes }),
  rerun: (id) => api.req('POST', `/api/searches/${id}/rerun`),
  save: (id, saved) => api.req('PATCH', `/api/searches/${id}`, { saved }),
  remove: (id) => api.req('DELETE', `/api/searches/${id}`),
};

/* ---------------- HOME ---------------- */

// Posições da colagem (estilo editorial) — até 6 tiles.
const SLOTS = [
  { left: '3%', top: '120px', w: 160, h: 210 },
  { left: '15%', top: '60px', w: 175, h: 220 },
  { left: '70%', top: '50px', w: 270, h: 165 },
  { left: '66%', top: '270px', w: 300, h: 225 },
  { left: '6%', top: '410px', w: 185, h: 225 },
  { left: '83%', top: '520px', w: 170, h: 205 },
];
const FALLBACK = [['#2b2b2b'], ['#6b4a2e'], ['#1f3a5f'], ['#111111'], ['#c8a227', 'light'], ['#2e6f6a']];

async function renderHome() {
  let list = [];
  try {
    list = await api.list();
  } catch {
    /* servidor fora do ar: home vazia */
  }

  // Tiles: salvas primeiro, depois recentes; um por termo.
  $$('.tile', $('#collage')).forEach((t) => t.remove());
  const seen = new Set();
  const picks = [...list.filter((s) => s.saved), ...list].filter((s) => {
    const k = s.term.toLowerCase();
    return s.status !== 'running' && !seen.has(k) && seen.add(k);
  }).slice(0, SLOTS.length);

  picks.forEach((s, i) => {
    const slot = SLOTS[i];
    const [bg, tone] = FALLBACK[i];
    const a = document.createElement('a');
    a.href = `#/s/${s.id}`;
    a.className = `tile ${s.cover ? '' : 'noimg'} ${!s.cover && tone ? tone : ''}`;
    Object.assign(a.style, { left: slot.left, top: slot.top, width: `${slot.w}px`, height: `${slot.h}px`, backgroundColor: bg });
    if (s.cover) a.style.backgroundImage = `url("${img(s.cover)}")`;
    a.innerHTML = `<span class="k">${s.saved ? 'Busca salva' : 'Recente'}</span><span class="t">${esc(s.term)}</span>`;
    $('#collage').insertBefore(a, $('.bigline'));
  });

  const ol = $('#historyList');
  ol.innerHTML = list.length
    ? list.map((s) => `
      <li>
        <a class="h-term" href="#/s/${s.id}">${esc(s.term)}</a>
        <span class="h-meta">${s.status === 'running' ? 'rodando…' : s.status === 'failed' ? 'falhou' : `${s.n_stores ?? 0} lojas · ${s.n_products ?? 0} produtos · ${s.n_promos ?? 0} promos`}</span>
        <span class="h-meta">${when(s.created_at)}</span>
        ${s.saved ? '<span class="badge red">salva</span>' : ''}
        <button type="button" class="icon-btn" data-del="${s.id}" aria-label="Apagar busca ${esc(s.term)}">Apagar</button>
      </li>`).join('')
    : '<li class="muted">Nenhuma busca ainda. Bora começar?</li>';
}

$('#historyList').addEventListener('click', async (e) => {
  const id = e.target.closest('[data-del]')?.dataset.del;
  if (!id) return;
  await api.remove(id);
  renderHome();
});

$$('.pill').forEach((p) =>
  p.addEventListener('click', () => {
    p.classList.toggle('on');
    p.setAttribute('aria-pressed', p.classList.contains('on'));
  })
);

async function startSearch(term, modes) {
  const { id } = await api.create(term, modes);
  location.hash = `#/s/${id}`;
}

$('#searchForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const term = $('#q').value.trim();
  const modes = $$('.pill.on').map((p) => p.dataset.mode);
  $('#formError').textContent = '';
  if (!modes.length) return ($('#formError').textContent = 'Escolha ao menos um: lojas, produtos ou promoções.');
  const btn = $('.circle');
  btn.disabled = true;
  try {
    await startSearch(term, modes);
    $('#q').value = '';
  } catch (err) {
    $('#formError').textContent = err.message;
  } finally {
    btn.disabled = false;
  }
});

$$('[data-scroll]').forEach((a) => a.addEventListener('click', () => setTimeout(() => $('#history').scrollIntoView({ behavior: 'smooth' }), 50)));

/* ---------------- RESULTS ---------------- */

let current = null;
let pollTimer = null;
let activeTab = 'stores';

function setTab(tab) {
  activeTab = tab;
  $$('.tab').forEach((t) => t.setAttribute('aria-selected', t.dataset.tab === tab));
  $$('.panel').forEach((p) => (p.hidden = p.dataset.panel !== tab));
}
$$('.tab').forEach((t) =>
  t.addEventListener('click', () => {
    setTab(t.dataset.tab);
    if (current) history.replaceState(null, '', `#/s/${current.id}/${t.dataset.tab}`);
  })
);

function storeCard(s) {
  const badges = [
    s.channel === 'instagram' ? '<span class="badge">Instagram</span>' : '',
    s.bigRetail ? '<span class="badge">grande varejo</span>' : '',
    s.likelyContent ? '<span class="badge">conteúdo?</span>' : '',
  ].join('');
  return `
    <article class="store">
      <span class="host">${esc(s.host)}</span>
      <h3>${esc(s.name)}</h3>
      <p>${esc(s.snippet || s.title)}</p>
      <div class="foot">
        <span>${badges}<span class="badge" title="Apareceu em ${s.hits} buscas">×${s.hits}</span></span>
        ${s.bigRetail
          ? `<a href="${esc(safeUrl(s.landing))}" target="_blank" rel="noopener">Ver na loja →</a>`
          : `<a href="${esc(safeUrl(s.url))}" target="_blank" rel="noopener">Abrir loja →</a>`}
      </div>
    </article>`;
}

const SOURCE_LABEL = { buscape: 'Buscapé', zoom: 'Zoom', kabum: 'KaBuM!', mercadolivre: 'Mercado Livre', pelando: 'Pelando' };

function productCard(p) {
  const price = brl(p.price);
  const pic = p.image ? `<img src="${esc(img(p.image))}" alt="" loading="lazy">` : '<span class="ph" aria-hidden="true">LOOP</span>';
  const meta = [
    p.storeCount > 1 ? `${p.storeCount} lojas` : '',
    p.extra?.temperature != null ? `${p.extra.temperature}° no Pelando` : '',
    p.extra?.postedAt ? when(p.extra.postedAt) : '',
    p.extra?.freeShipping ? 'frete grátis' : '',
    p.extra?.coupon ? 'cupom' : '',
  ].filter(Boolean).join(' · ');
  return `
    <a class="product" href="${esc(safeUrl(p.url))}" target="_blank" rel="noopener">
      <div class="thumb">${pic}${p.discount ? `<span class="off">−${esc(p.discount)}%</span>` : ''}</div>
      <span class="src">${esc(SOURCE_LABEL[p.source] || p.source)}${p.store && p.store !== SOURCE_LABEL[p.source] ? ` · ${esc(p.store)}` : ''}</span>
      <h3>${esc(p.title)}</h3>
      ${price
        ? `<div class="price-row"><span class="price">${price}</span>${p.oldPrice ? `<s class="old">${brl(p.oldPrice)}</s>` : ''}</div>`
        : '<span class="price none">Ver preço na loja →</span>'}
      ${meta ? `<span class="meta">${esc(meta)}</span>` : ''}
    </a>`;
}

// Imagem que falhar vira o placeholder do LOOP.
document.addEventListener('error', (e) => {
  if (e.target.tagName === 'IMG' && e.target.closest('.thumb')) e.target.replaceWith(Object.assign(document.createElement('span'), { className: 'ph', textContent: 'LOOP' }));
}, true);

const empty = (msg) => `<p class="empty">${msg}</p>`;

function renderProducts() {
  if (!current?.result) return;
  const sort = $('#sortProducts').value;
  const f = $('#filterProducts').value.trim().toLowerCase();
  const src = $('#sourceProducts').value;
  let list = current.result.products.filter((p) => (!f || p.title.toLowerCase().includes(f)) && (!src || p.source === src));
  const priceOrInf = (p, dir) => p.price ?? (dir > 0 ? Infinity : -Infinity);
  if (sort === 'price') list = [...list].sort((a, b) => priceOrInf(a, 1) - priceOrInf(b, 1));
  if (sort === 'priceDesc') list = [...list].sort((a, b) => priceOrInf(b, -1) - priceOrInf(a, -1));
  $('#productGrid').innerHTML = list.length ? list.map(productCard).join('') : empty(current.modes.includes('products') ? 'Nenhum produto encontrado.' : 'Produtos não foram incluídos nessa busca.');
}

function visibleStores() {
  const hide = $('#hideContent').checked;
  const kind = $('#storeFilter').value;
  return current.result.stores.filter(
    (s) => (!hide || !s.likelyContent) && (kind === 'all' || (kind === 'big') === !!s.bigRetail)
  );
}

function renderStores() {
  if (!current?.result) return;
  const list = visibleStores();
  $('#storeGrid').innerHTML = list.length ? list.map(storeCard).join('') : empty(current.modes.includes('stores') ? 'Nenhuma loja encontrada.' : 'Lojas não foram incluídas nessa busca.');
}

function renderResults() {
  const s = current;
  $('#termTitle').textContent = s.term;
  $('#q2').value = s.term;
  $('#saveBtn').textContent = s.saved ? 'Salva ✓' : 'Salvar busca';
  $('#saveBtn').classList.toggle('active', s.saved);
  $('#csvBtn').href = `/api/searches/${s.id}/export.csv`;

  const running = s.status === 'running';
  $('#loading').hidden = !running;
  $('#statusLine').textContent = running ? 'Varrendo…' : s.status === 'failed' ? 'Varredura falhou — veja o log' : `Varredura de ${when(s.finished_at)}`;
  $$('.panel').forEach((p) => p.classList.toggle('dim', running));

  const r = s.result;
  $('#cStores').textContent = r ? visibleStores().length : '';
  $('#cProducts').textContent = r ? r.products.length : '';
  $('#cPromos').textContent = r ? r.promos.length : '';
  if (!r) {
    ['#storeGrid', '#productGrid', '#promoGrid'].forEach((g) => ($(g).innerHTML = ''));
  } else {
    renderStores();
    renderProducts();
    $('#promoGrid').innerHTML = r.promos.length ? r.promos.map(productCard).join('') : empty(s.modes.includes('promos') ? 'Nenhuma promoção ativa no Pelando pra esse termo. Tente um termo mais curto.' : 'Promoções não foram incluídas nessa busca.');
    $('#mlLink').href = safeUrl(r.links?.mercadoLivre);
  }

  $('#logList').innerHTML = (s.log || []).map((l) => {
    if (l.notes) return l.notes.map((n) => `<li>↳ ${esc(n)}</li>`).join('');
    return `<li class="${l.ok ? '' : 'bad'}"><b>${esc(l.source)}</b> — ${l.ok ? `${l.count ?? 0} itens` : `erro: ${esc(l.error)}`} (${l.ms} ms)</li>`;
  }).join('');
}

async function loadSearch(id) {
  clearTimeout(pollTimer);
  try {
    current = await api.get(id);
  } catch (err) {
    $('#termTitle').textContent = 'NÃO ACHEI';
    $('#statusLine').textContent = err.message;
    return;
  }
  // Abre na primeira aba que foi pedida na busca.
  if (!current.modes.includes(activeTab)) setTab(current.modes[0]);
  renderResults();
  if (current.status === 'running') pollTimer = setTimeout(() => loadSearch(id), 1500);
}

$('#hideContent').addEventListener('change', () => current && renderResults());
$('#storeFilter').addEventListener('change', () => current && renderResults());
$('#sourceProducts').addEventListener('change', renderProducts);
$('#sortProducts').addEventListener('change', renderProducts);
$('#filterProducts').addEventListener('input', renderProducts);

$('#saveBtn').addEventListener('click', async () => {
  if (!current) return;
  await api.save(current.id, !current.saved);
  current.saved = !current.saved;
  renderResults();
});
$('#rerunBtn').addEventListener('click', async () => {
  if (!current) return;
  const { id } = await api.rerun(current.id);
  location.hash = `#/s/${id}`;
});
$('#miniForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const term = $('#q2').value.trim();
  if (term) await startSearch(term, current?.modes ?? ['stores', 'products', 'promos']);
});

/* ---------------- ROUTER ---------------- */

function route() {
  clearTimeout(pollTimer);
  const h = location.hash;
  const m = h.match(/^#\/s\/(\d+)(?:\/(stores|products|promos))?/);
  $('#home').hidden = !!m || h === '#/sobre';
  $('#results').hidden = !m;
  $('#about').hidden = h !== '#/sobre';
  window.scrollTo(0, 0);
  if (m) {
    setTab(m[2] || 'stores');
    loadSearch(m[1]);
  } else if (h !== '#/sobre') {
    renderHome();
  }
}
window.addEventListener('hashchange', route);
route();
