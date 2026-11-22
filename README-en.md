# LOOP — Looking Promos

> Author: **Hélio Delfino Lopes de Alcântara** — Security researcher & web penetration tester

A local Black Friday scraper: type a niche ("perfume árabe", "moda plus size") and LOOP sweeps the web for **stores**, **products** and **deals**.

## Run

```powershell
cd C:\Users\Pichau\loop
npm install   # first time only
npm start     # or double-click start.bat
```

Open **http://127.0.0.1:4747**. Requires Node 22+ (uses the built-in `node:sqlite`).

## Sources

| Tab | Source | What it returns |
|---|---|---|
| Stores | Web search — Yahoo BR (DuckDuckGo and Bing as fallback), 8 queries × 3 pages | Niche stores, large retailers (badged and filterable) and Instagram profiles, grouped by domain, relevance-filtered |
| Products | Buscapé (5 pages) and Zoom (3 pages) | Product, lowest price, best-offer merchant, number of stores |
| Products | KaBuM! | Up to 100 items, with cash/flash-sale price, list price and discount % |
| Products | Mercado Livre (via `site:` web search) | Listings and official stores, **no price** |
| Deals | Pelando | Community deals with price, store, temperature and date |

## Known limitations

- **Mercado Livre blocks direct scraping**: the public API returns 403 and the listing page redirects to account verification (tested with `fetch` and headless Edge). ML prices only show up when the deal comes through Pelando. The Products tab links straight to the ML search.
- **Magalu, Casas Bahia, Shopee, Amazon and Americanas** block scraping or render products client-side; they show up as stores (via web search) but without a product catalog.
- **DuckDuckGo** starts asking for a captcha after many back-to-back searches, which is why Yahoo is the primary engine.
- The "Show" filter separates niche stores from large retailers; "Hide content sites" removes blogs and magazines.
- Scrapers depend on third-party HTML; if a site changes its layout, that source shows an error in the **Source log** and the others keep working.

## Layout

```
server.js               Express API + image proxy (allowlisted) + CSV export
src/engine.js           runs the sources per mode
src/sources/*.js        websearch, stores, buscape (+zoom), kabum, pelando, mercadolivre
src/db.js               SQLite history (data/loop.db)
public/                 front-end (plain HTML/CSS/JS)
```
